// Jackpot, coach-triggered random gift wheel (ECONOMY_SPEC.md section 6).
// The server owns the roll: weighted pick over active prizes, fulfillment in
// the same mutation, audit row, activity + celebration. The client wheel only
// animates toward the prizeKey returned here, never rolls on its own.
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { applyPoints, logActivity, publishEvent } from "./helpers";
import { AVATAR_ITEMS, AvatarRarity } from "../avatarCatalog";

const prizeKind = v.union(
  v.literal("POINTS"),
  v.literal("TOKENS"),
  v.literal("AVATAR_ITEM")
);

// Stable ordering shared by the editor and the wheel: heaviest first, then key.
const sortPrizes = <T extends { weight: number; key: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));

// All prizes, for the admin pool editor.
export const prizes = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("jackpotPrizes").collect();
    return sortPrizes(rows);
  },
});

// Active prizes only: these are the wheel segments.
export const activePrizes = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("jackpotPrizes")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return sortPrizes(rows);
  },
});

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export const upsertPrize = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    kind: prizeKind,
    value: v.string(),
    weight: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const weight = Math.max(0, Math.round(args.weight));
    const existing = await ctx.db
      .query("jackpotPrizes")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        kind: args.kind,
        value: args.value,
        weight,
        active: args.active,
      });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("jackpotPrizes", {
      key: args.key,
      label: args.label,
      kind: args.kind,
      value: args.value,
      weight,
      active: args.active,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const removePrize = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("jackpotPrizes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const toggleActive = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("jackpotPrizes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!existing) throw new Error("Prize not found");
    await ctx.db.patch(existing._id, { active: !existing.active });
    return await ctx.db.get(existing._id);
  },
});

// ── Seed (idempotent by key; the integrator runs this after deploy) ─────────

const DEFAULT_PRIZES: Array<{
  key: string;
  label: string;
  kind: "POINTS" | "TOKENS" | "AVATAR_ITEM";
  value: string;
  weight: number;
}> = [
  { key: "p25", label: "25 Points", kind: "POINTS", value: "25", weight: 40 },
  { key: "p50", label: "50 Points", kind: "POINTS", value: "50", weight: 25 },
  { key: "p100", label: "100 Points", kind: "POINTS", value: "100", weight: 12 },
  { key: "t5", label: "5 FitTokens", kind: "TOKENS", value: "5", weight: 10 },
  { key: "itemU", label: "Mystery Item", kind: "AVATAR_ITEM", value: "uncommon", weight: 9 },
  { key: "itemL", label: "LEGENDARY Item", kind: "AVATAR_ITEM", value: "legendary", weight: 3 },
  { key: "p250", label: "MEGA 250 Points", kind: "POINTS", value: "250", weight: 1 },
];

export const seedPrizes = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    for (const prize of DEFAULT_PRIZES) {
      const existing = await ctx.db
        .query("jackpotPrizes")
        .withIndex("by_key", (q) => q.eq("key", prize.key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("jackpotPrizes", {
        ...prize,
        active: true,
        createdAt: Date.now(),
      });
      inserted++;
    }
    return { inserted, total: DEFAULT_PRIZES.length };
  },
});

// ── Spin: weighted server-side pick + fulfillment in one mutation ────────────

export const spin = mutation({
  args: {
    studentId: v.id("students"),
    byAdmin: v.string(),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const actives = await ctx.db
      .query("jackpotPrizes")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const pool = actives.filter((p) => p.weight > 0);
    if (pool.length === 0) throw new Error("No active prizes on the wheel yet");

    // Weighted pick (Convex mutations seed Math.random, same as lootBoxes)
    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = pool[pool.length - 1];
    for (const p of pool) {
      roll -= p.weight;
      if (roll < 0) {
        picked = p;
        break;
      }
    }

    // Fulfill in the same mutation. The JACKPOT sourceType is on the
    // multiplier/gear exclusion list in helpers.applyPoints (agent B, spec
    // section 2), so gift credits are never amplified.
    let resolvedKind: "POINTS" | "TOKENS" | "AVATAR_ITEM" = picked.kind;
    let label = picked.label;
    let resolvedItemKey: string | undefined;

    if (picked.kind === "POINTS") {
      const amount = Math.max(1, Math.round(Number(picked.value) || 0));
      await applyPoints(ctx, args.studentId, amount, "JACKPOT", "Jackpot prize", args.byAdmin);
    } else if (picked.kind === "TOKENS") {
      const amount = Math.max(1, Math.round(Number(picked.value) || 0));
      await ctx.db.patch(args.studentId, {
        fitTokens: (student.fitTokens ?? 0) + amount,
      });
      await ctx.db.insert("fitTokenLedger", {
        studentId: args.studentId,
        amount,
        kind: "JACKPOT",
        description: "Jackpot prize",
        byName: args.byAdmin,
        createdAt: Date.now(),
      });
    } else {
      // AVATAR_ITEM: random unowned item of the rolled rarity
      const rarity = picked.value as AvatarRarity;
      const owned = await ctx.db
        .query("studentWearables")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect();
      const ownedKeys = new Set(owned.map((w) => w.wearableId));
      const candidates = AVATAR_ITEMS.filter(
        (i) => i.rarity === rarity && !i.isDefault && !ownedKeys.has(i.key)
      );
      if (candidates.length === 0) {
        // Kid owns every item of that rarity: swap to a 50 point bonus
        resolvedKind = "POINTS";
        label = `50 Points (owns every ${rarity} item)`;
        await applyPoints(ctx, args.studentId, 50, "JACKPOT", "Jackpot prize", args.byAdmin);
      } else {
        const item = candidates[Math.floor(Math.random() * candidates.length)];
        resolvedItemKey = item.key;
        label = item.name;
        await ctx.db.insert("studentWearables", {
          studentId: args.studentId,
          wearableId: item.key,
          acquiredAt: Date.now(),
          upgradeLevel: 0,
        });
        // Instant gratification: equip the fresh prize (same as lootBoxes.open)
        const look = student.avatarLook ?? {};
        const slotKey =
          item.slot === "HAIRSTYLE" ? "hair" : item.slot === "TOP" ? "top" : "acc";
        await ctx.db.patch(args.studentId, {
          avatarLook: { ...look, [slotKey]: item.key },
        });
      }
    }

    // Audit row records what actually landed ("Volt Hawk", not "Mystery Item")
    await ctx.db.insert("jackpotSpins", {
      studentId: args.studentId,
      prizeKey: picked.key,
      label,
      byAdmin: args.byAdmin,
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      type: "BADGE_EARNED",
      message: `JACKPOT! ${student.fullName} won ${label}`,
      adminName: args.byAdmin,
      studentId: args.studentId,
      studentName: student.fullName,
      avatarUrl: student.avatarUrl,
    });

    // Big-board celebration, same channel + payload shape as medals.award
    await publishEvent(ctx, "rank_up", {
      type: "BADGE_EARNED",
      studentName: student.fullName,
      achievement: `JACKPOT! ${label}`,
      studentAvatar: student.avatarUrl,
      message: `JACKPOT! ${student.fullName} won ${label}`,
      ts: Date.now(),
    });

    return { prizeKey: picked.key, kind: resolvedKind, label, resolvedItemKey };
  },
});

// Latest spins with student names, for the panel's history list.
export const recentSpins = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("jackpotSpins")
      .withIndex("by_createdAt")
      .order("desc")
      .take(20);
    const out = [];
    for (const spinRow of rows) {
      const student = await ctx.db.get(spinRow.studentId);
      out.push({
        ...spinRow,
        studentName: student?.fullName ?? "(removed)",
        gamerTag: student?.gamerTag ?? null,
        avatarUrl: student?.avatarUrl ?? null,
      });
    }
    return out;
  },
});
