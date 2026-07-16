import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { applyPoints, logActivity, requireParent, requireParentLink } from "./helpers";

// Spend points on a perk. Virtual avatar skins auto-fulfill (swap avatarUrl);
// Real perks land in the admin fulfillment queue.
export const redeem = mutation({
  args: {
    studentId: v.id("students"),
    rewardKey: v.string(),
    requestedVia: v.union(v.literal("STUDENT"), v.literal("PARENT")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let actorName = "Student Portal";
    if (args.requestedVia === "PARENT") {
      if (!args.sessionToken) throw new Error("Sign in to redeem");
      const parent = await requireParent(ctx, args.sessionToken);
      await requireParentLink(ctx, parent._id, args.studentId);
      actorName = parent.fullName;
    }

    const reward = await ctx.db
      .query("rewards")
      .withIndex("by_key", (q) => q.eq("key", args.rewardKey))
      .unique();
    if (!reward) throw new Error("Perk not found");

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    if (student.points < reward.cost) {
      throw new Error(
        `Not enough points — ${reward.name} costs ${reward.cost}, you have ${student.points}`
      );
    }

    await applyPoints(
      ctx,
      args.studentId,
      -reward.cost,
      "REDEMPTION",
      `Redeemed: ${reward.name}`,
      actorName
    );

    const isSkin = reward.category === "Virtual" && !!reward.value;
    if (isSkin) {
      await ctx.db.patch(args.studentId, { avatarUrl: reward.value! });
    }
    // Track ownership in the existing inventory list (keys)
    if (!student.inventory.includes(reward.key)) {
      await ctx.db.patch(args.studentId, {
        inventory: [...student.inventory, reward.key],
      });
    }

    const now = Date.now();
    const id = await ctx.db.insert("redemptions", {
      studentId: args.studentId,
      rewardKey: reward.key,
      rewardName: reward.name,
      rewardIcon: reward.icon,
      cost: reward.cost,
      status: isSkin ? "FULFILLED" : "PENDING",
      requestedVia: args.requestedVia,
      fulfilledBy: isSkin ? "auto" : null,
      fulfilledAt: isSkin ? now : null,
      createdAt: now,
    });

    await logActivity(ctx, {
      type: "REWARD_CLAIMED",
      message: isSkin
        ? `${student.fullName} unlocked the ${reward.name} skin! ${reward.icon}`
        : `${student.fullName} redeemed ${reward.name} (${reward.cost} pts) ${reward.icon}`,
      adminName: actorName,
      studentId: args.studentId,
      studentName: student.fullName,
      amount: -reward.cost,
    });

    return await ctx.db.get(id);
  },
});

export const forStudent = query({
  args: { studentId: v.id("students"), limit: v.optional(v.number()) },
  handler: async (ctx, { studentId, limit }) => {
    return await ctx.db
      .query("redemptions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(limit ?? 30);
  },
});

export const forParent = query({
  args: { sessionToken: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, limit }) => {
    const parent = await requireParent(ctx, sessionToken);
    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .collect();
    const out = [];
    for (const link of links) {
      const student = await ctx.db.get(link.studentId);
      if (!student) continue;
      const rows = await ctx.db
        .query("redemptions")
        .withIndex("by_student", (q) => q.eq("studentId", link.studentId))
        .order("desc")
        .take(limit ?? 20);
      for (const row of rows) out.push({ redemption: row, studentName: student.fullName });
    }
    return out.sort((a, b) => b.redemption.createdAt - a.redemption.createdAt);
  },
});

// Admin fulfillment queue.
export const pending = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("redemptions")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("desc")
      .collect();
    const out = [];
    for (const row of rows) {
      const student = await ctx.db.get(row.studentId);
      out.push({ redemption: row, studentName: student?.fullName ?? "(removed)" });
    }
    return out;
  },
});

export const fulfill = mutation({
  args: { redemptionId: v.id("redemptions"), adminName: v.string() },
  handler: async (ctx, { redemptionId, adminName }) => {
    const row = await ctx.db.get(redemptionId);
    if (!row) throw new Error("Redemption not found");
    if (row.status !== "PENDING") throw new Error("Already handled");
    await ctx.db.patch(redemptionId, {
      status: "FULFILLED",
      fulfilledBy: adminName,
      fulfilledAt: Date.now(),
    });
    return await ctx.db.get(redemptionId);
  },
});

// Cancel refunds the points and removes the perk from inventory.
export const cancel = mutation({
  args: { redemptionId: v.id("redemptions"), adminName: v.string() },
  handler: async (ctx, { redemptionId, adminName }) => {
    const row = await ctx.db.get(redemptionId);
    if (!row) throw new Error("Redemption not found");
    if (row.status !== "PENDING") throw new Error("Already handled");
    await ctx.db.patch(redemptionId, {
      status: "CANCELLED",
      fulfilledBy: adminName,
      fulfilledAt: Date.now(),
    });
    await applyPoints(
      ctx,
      row.studentId,
      row.cost,
      "REDEMPTION",
      `Refund: ${row.rewardName}`,
      adminName
    );
    const student = await ctx.db.get(row.studentId);
    if (student) {
      await ctx.db.patch(row.studentId, {
        inventory: student.inventory.filter((k) => k !== row.rewardKey),
      });
    }
    return await ctx.db.get(redemptionId);
  },
});
