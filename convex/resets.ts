import { mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { logActivity } from "./helpers";

// Season reset: zero out player progress in tiers, guarded by a REAL
// two-step confirmation. Step 1 (arm) picks a tier and mints a one-time
// 6-digit code that expires in 5 minutes; step 2 (execute) must present that
// exact code. Nothing runs on a single click, ever.
//
// Tiers:
//   POINTS - zero every player's point balance (ranks back to Noob).
//            KEEPS XP / Volt Levels, medals, badges, gear, cosmetics.
//   XP     - zero every player's XP (Volt Level back to 1, perk loadouts
//            cleared since their unlock levels are gone). KEEPS points.
//   FULL   - points AND levels AND achievements: points, XP, ranks, medals,
//            milestone history driven by badges array, gear + activations,
//            Volt loadouts.
//
// NEVER touched by any tier: FitTokens (parent-paid money), avatar items and
// looks, marketplace orders, and the transaction/XP ledgers (audit history
// stays; every reset writes its own audit rows).

const ARM_KEY = "season_reset_arm";
const ARM_TTL_MS = 5 * 60 * 1000;

const tierValidator = v.union(v.literal("POINTS"), v.literal("XP"), v.literal("FULL"));
type Tier = "POINTS" | "XP" | "FULL";

const EMPTY_LOADOUT = { perk1: null, perk2: null, perk3: null, flex: null, wildcard: null };

export const armed = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ARM_KEY))
      .unique();
    if (!row) return null;
    try {
      const data = JSON.parse(row.value) as { tier: Tier; adminName: string; expiresAt: number };
      if (data.expiresAt < Date.now()) return null;
      return { tier: data.tier, adminName: data.adminName, expiresAt: data.expiresAt };
    } catch {
      return null;
    }
  },
});

// Step 1: arm the reset. Returns the one-time code the admin must retype.
export const arm = mutation({
  args: { tier: tierValidator, adminName: v.string() },
  handler: async (ctx, { tier, adminName }) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const value = JSON.stringify({ code, tier, adminName, expiresAt: Date.now() + ARM_TTL_MS });
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ARM_KEY))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    else await ctx.db.insert("appSettings", { key: ARM_KEY, value, updatedAt: Date.now() });
    await logActivity(ctx, {
      type: "SYSTEM",
      message: `Season reset ARMED (${tier}) by ${adminName} — awaiting confirmation code`,
      adminName,
    });
    return { code, tier, expiresAt: Date.now() + ARM_TTL_MS };
  },
});

export const disarm = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ARM_KEY))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

// Step 2: execute with the code from step 1.
export const execute = mutation({
  args: { code: v.string(), adminName: v.string() },
  handler: async (ctx, { code, adminName }) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", ARM_KEY))
      .unique();
    // ConvexError (not plain Error) so the reason reaches the client — Convex
    // redacts plain thrown Errors to a generic "Server Error" in production.
    if (!row) throw new ConvexError("No reset is armed. Start again from step 1.");
    let data: { code: string; tier: Tier; expiresAt: number };
    try {
      data = JSON.parse(row.value);
    } catch {
      await ctx.db.delete(row._id);
      throw new ConvexError("The armed reset was unreadable. Start again.");
    }
    if (data.expiresAt < Date.now()) {
      await ctx.db.delete(row._id);
      throw new ConvexError("The confirmation code expired. Start again from step 1.");
    }
    if (data.code !== code.trim()) {
      throw new ConvexError("That code does not match. Check it and try again.");
    }
    // Consume the code before doing anything — single use.
    await ctx.db.delete(row._id);

    const tier = data.tier;
    const students = await ctx.db.query("students").collect();
    const now = Date.now();

    // Board boundary: earnedBetween ignores everything earned before this, so
    // every standings range (Today/Week/Season) + Hall of Fame drop to zero
    // immediately — without deleting the ledger. POINTS + FULL clear the points
    // board; XP-only leaves it alone.
    if (tier === "POINTS" || tier === "FULL") {
      const marker = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "season_reset_at"))
        .unique();
      if (marker) await ctx.db.patch(marker._id, { value: String(now), updatedAt: now });
      else await ctx.db.insert("appSettings", { key: "season_reset_at", value: String(now), updatedAt: now });
    }

    for (const s of students) {
      if (tier === "POINTS" || tier === "FULL") {
        await ctx.db.patch(s._id, { points: 0, rankId: "r_noob" });
        await ctx.db.insert("transactions", {
          studentId: s._id,
          amount: -s.points,
          sourceType: "SYSTEM",
          description: `Season reset (${tier}): points zeroed`,
          adminName,
          createdAt: now,
        });
      }
      if (tier === "XP" || tier === "FULL") {
        await ctx.db.patch(s._id, { totalXp: 0, voltLoadout: EMPTY_LOADOUT });
        await ctx.db.insert("xpTransactions", {
          studentId: s._id,
          amount: -(s.totalXp ?? 0),
          sourceType: "SYSTEM",
          description: `Season reset (${tier}): XP zeroed`,
          createdAt: now,
        });
      }
      if (tier === "FULL") {
        await ctx.db.patch(s._id, { badges: [], gearEquipped: null });
        const medals = await ctx.db
          .query("medals")
          .withIndex("by_student", (q) => q.eq("studentId", s._id))
          .collect();
        for (const m of medals) await ctx.db.delete(m._id);
        const gear = await ctx.db
          .query("studentGear")
          .withIndex("by_student", (q) => q.eq("studentId", s._id))
          .collect();
        for (const g of gear) await ctx.db.delete(g._id);
        const activations = await ctx.db
          .query("gearActivations")
          .withIndex("by_student_date", (q) => q.eq("studentId", s._id))
          .collect();
        for (const a of activations) await ctx.db.delete(a._id);
      }
    }

    await logActivity(ctx, {
      type: "SYSTEM",
      message: `SEASON RESET (${tier}) executed by ${adminName}: ${students.length} players zeroed`,
      adminName,
    });
    return { ok: true, tier, players: students.length };
  },
});

// Admin/CLI-only: stamp the board boundary to now WITHOUT running a full reset.
// Used to retro-apply the boundary after a reset ran before the boundary logic
// existed (points already zeroed, but the standings ledger still summed old
// earnings). Not client-callable.
export const stampSeasonBoundaryNow = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const marker = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "season_reset_at"))
      .unique();
    if (marker) await ctx.db.patch(marker._id, { value: String(now), updatedAt: now });
    else await ctx.db.insert("appSettings", { key: "season_reset_at", value: String(now), updatedAt: now });
    return { stampedAt: now };
  },
});
