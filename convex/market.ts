// Points marketplace, in-kind donated prizes with confirmed handover
// (ECONOMY_SPEC.md section 7). Kids spend points on real donated prizes; every
// redemption issues a claim code and waits in the admin pickup queue until
// staff confirms the handover at the front desk. No money anywhere in here.
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { applyPoints, logActivity, randomToken } from "./helpers";

// Active shelf for the student portal (qty included so the UI can show
// "x left" and sold-out states without a second query).
export const activeItems = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("marketItems")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return rows.sort((a, b) => a.pointCost - b.pointCost || a.name.localeCompare(b.name));
  },
});

// Everything, for the admin items editor.
export const adminItems = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("marketItems").collect();
    return rows.sort(
      (a, b) => Number(b.active) - Number(a.active) || b.createdAt - a.createdAt
    );
  },
});

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export const upsertItem = mutation({
  args: {
    id: v.optional(v.id("marketItems")),
    name: v.string(),
    description: v.string(),
    icon: v.string(),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    pointCost: v.number(),
    qtyAvailable: v.number(),
    donatedBy: v.optional(v.union(v.string(), v.null())),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const fields = {
      name: args.name.trim(),
      description: args.description.trim(),
      icon: args.icon.trim() || "Gift",
      imageUrl: args.imageUrl ?? null,
      pointCost: Math.max(1, Math.round(args.pointCost)),
      qtyAvailable: Math.max(0, Math.round(args.qtyAvailable)),
      donatedBy: args.donatedBy ?? null,
      active: args.active,
    };
    if (!fields.name) throw new Error("Please give the prize a name");
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Prize not found");
      await ctx.db.patch(args.id, fields);
      return await ctx.db.get(args.id);
    }
    const id = await ctx.db.insert("marketItems", {
      ...fields,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const removeItem = mutation({
  args: { id: v.id("marketItems") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (existing) await ctx.db.delete(id);
  },
});

// ── Seed (idempotent by name; the integrator runs this after deploy) ─────────

export const seedMarket = internalMutation({
  args: {},
  handler: async (ctx) => {
    const name = "Angels Game Tickets (Pair)";
    const all = await ctx.db.query("marketItems").collect();
    if (all.some((i) => i.name === name)) return { inserted: 0 };
    await ctx.db.insert("marketItems", {
      name,
      description:
        "Two tickets to an Angels home game, donated by a community sponsor. Pick up at the front desk.",
      icon: "Tag",
      imageUrl: null,
      pointCost: 2000,
      qtyAvailable: 2,
      donatedBy: "Community sponsor",
      active: true,
      createdAt: Date.now(),
    });
    return { inserted: 1 };
  },
});

// ── Redeem / cancel / confirm ────────────────────────────────────────────────

export const redeem = mutation({
  args: {
    studentId: v.id("students"),
    itemId: v.id("marketItems"),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || !item.active) throw new Error("That prize is not available right now");
    if (item.qtyAvailable <= 0) throw new Error("Sold out! Keep an eye out for the next drop");

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    if (student.points < item.pointCost) {
      throw new Error(`You need ${item.pointCost - student.points} more points for that`);
    }

    await ctx.db.patch(args.itemId, { qtyAvailable: item.qtyAvailable - 1 });

    await applyPoints(
      ctx,
      args.studentId,
      -item.pointCost,
      "REDEMPTION",
      `Marketplace: ${item.name}`,
      "Marketplace"
    );

    // 3 random bytes -> 6 uppercase hex chars, the code the family shows at the desk
    const claimCode = randomToken(3).toUpperCase();
    const orderId = await ctx.db.insert("marketOrders", {
      studentId: args.studentId,
      itemId: args.itemId,
      itemName: item.name,
      cost: item.pointCost,
      claimCode,
      status: "PENDING",
      requestedVia: "STUDENT",
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      type: "REWARD_CLAIMED",
      message: `${student.fullName} claimed ${item.name} in the Marketplace (${item.pointCost} pts)`,
      adminName: "Marketplace",
      studentId: args.studentId,
      studentName: student.fullName,
      avatarUrl: student.avatarUrl,
      amount: -item.pointCost,
    });

    return await ctx.db.get(orderId);
  },
});

// PENDING only. Restores quantity (unless the item was deleted) and refunds
// the points. Kids can cancel their own pending order; admins too.
export const cancelOrder = mutation({
  args: { orderId: v.id("marketOrders"), byName: v.string() },
  handler: async (ctx, { orderId, byName }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "PENDING") throw new Error("Already handled");

    const item = await ctx.db.get(order.itemId);
    if (item) {
      await ctx.db.patch(order.itemId, { qtyAvailable: item.qtyAvailable + 1 });
    }

    await applyPoints(
      ctx,
      order.studentId,
      order.cost,
      "REDEMPTION",
      `Marketplace refund: ${order.itemName}`,
      byName
    );

    await ctx.db.patch(orderId, { status: "CANCELLED", resolvedAt: Date.now() });
    return await ctx.db.get(orderId);
  },
});

// THIS is the required confirmation step: the family shows the claim code at
// the desk, staff matches it in the queue and confirms the handover.
export const confirmOrder = mutation({
  args: { orderId: v.id("marketOrders"), byName: v.string() },
  handler: async (ctx, { orderId, byName }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "PENDING") throw new Error("Already handled");

    await ctx.db.patch(orderId, {
      status: "FULFILLED",
      confirmedBy: byName,
      resolvedAt: Date.now(),
    });

    const student = await ctx.db.get(order.studentId);
    await logActivity(ctx, {
      type: "REWARD_CLAIMED",
      message: `${student?.fullName ?? "A player"} picked up ${order.itemName}`,
      adminName: byName,
      studentId: order.studentId,
      studentName: student?.fullName ?? null,
      avatarUrl: student?.avatarUrl ?? null,
    });

    return await ctx.db.get(orderId);
  },
});

// ── Queries ──────────────────────────────────────────────────────────────────

export const myOrders = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await ctx.db
      .query("marketOrders")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(30);
  },
});

// Pickup queue: pending orders oldest-first (longest wait on top) with student
// names joined, then a short recent-resolved tail.
export const adminQueue = query({
  args: {},
  handler: async (ctx) => {
    const withStudent = async (orders: Doc<"marketOrders">[]) => {
      const out = [];
      for (const order of orders) {
        const student = await ctx.db.get(order.studentId);
        out.push({
          order,
          studentName: student?.fullName ?? "(removed)",
          gamerTag: student?.gamerTag ?? null,
          avatarUrl: student?.avatarUrl ?? null,
        });
      }
      return out;
    };

    const pendingRows = await ctx.db
      .query("marketOrders")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("asc")
      .collect();

    const fulfilled = await ctx.db
      .query("marketOrders")
      .withIndex("by_status", (q) => q.eq("status", "FULFILLED"))
      .order("desc")
      .take(10);
    const cancelled = await ctx.db
      .query("marketOrders")
      .withIndex("by_status", (q) => q.eq("status", "CANCELLED"))
      .order("desc")
      .take(10);
    const resolvedRows = [...fulfilled, ...cancelled]
      .sort((a, b) => (b.resolvedAt ?? b.createdAt) - (a.resolvedAt ?? a.createdAt))
      .slice(0, 12);

    return {
      pending: await withStudent(pendingRows),
      resolved: await withStudent(resolvedRows),
    };
  },
});
