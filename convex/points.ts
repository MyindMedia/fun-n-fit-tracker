import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { houseId } from "./schema";
import { applyPoints, logActivity } from "./helpers";
import { HOUSES } from "../constants";
import { XP_SOURCES } from "../voltCatalog";

export const award = mutation({
  args: {
    studentId: v.id("students"),
    amount: v.number(),
    sourceType: v.string(),
    description: v.string(),
    adminName: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await applyPoints(
      ctx,
      args.studentId,
      args.amount,
      args.sourceType,
      args.description,
      args.adminName,
      args.clientId
    );
  },
});

export const batchAward = mutation({
  args: {
    studentIds: v.array(v.id("students")),
    amount: v.number(),
    description: v.string(),
    adminName: v.string(),
    clientId: v.optional(v.string()),
    gameSessionId: v.optional(v.id("gameSessions")),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.studentIds) {
      try {
        results.push(
          await applyPoints(
            ctx,
            id,
            args.amount,
            "MANUAL",
            args.description,
            args.adminName,
            args.clientId,
            args.gameSessionId
          )
        );
      } catch {
        // Skip students that fail (e.g. deleted mid-batch), mirroring old behavior
      }
    }
    return results;
  },
});

export const houseAward = mutation({
  args: {
    houseId: houseId,
    amount: v.number(), // positive for bonus, negative for deduction
    description: v.string(),
    adminName: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_house", (q) => q.eq("houseId", args.houseId))
      .collect();
    const present = students.filter((s) => s.isPresent);
    const houseName = HOUSES[args.houseId].name;

    if (present.length === 0) {
      throw new Error(`No present students found in ${houseName} house`);
    }

    const results = [];
    for (const s of present) {
      results.push(
        await applyPoints(
          ctx,
          s._id,
          args.amount,
          "MANUAL",
          args.description,
          args.adminName,
          args.clientId
        )
      );
    }

    const amt = Math.abs(args.amount);
    await logActivity(ctx, {
      type: "POINTS",
      message:
        args.amount >= 0
          ? `House Bonus: ${houseName} +${amt}pts`
          : `House Deduction: ${houseName} -${amt}pts`,
      adminName: args.adminName,
    });
    return { count: present.length, results };
  },
});

export const recordScoreEvent = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    studentId: v.optional(v.id("students")),
    houseId: v.optional(houseId),
    amount: v.number(),
    adminName: v.string(),
    description: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.studentId) {
      const result = await applyPoints(
        ctx,
        args.studentId,
        args.amount,
        "MANUAL",
        args.description,
        args.adminName,
        args.clientId,
        args.sessionId
      );
      return [result];
    }
    if (args.houseId) {
      const session = await ctx.db.get(args.sessionId);
      const roster = new Set(session?.roster ?? []);
      const students = await ctx.db
        .query("students")
        .withIndex("by_house", (q) => q.eq("houseId", args.houseId!))
        .collect();
      const targeted = students.filter((s) => roster.has(s._id));
      const results = [];
      for (const s of targeted) {
        results.push(
          await applyPoints(
            ctx,
            s._id,
            args.amount,
            "MANUAL",
            args.description,
            args.adminName,
            args.clientId,
            args.sessionId
          )
        );
      }
      return results;
    }
    return [];
  },
});

export const undoLast = mutation({
  args: { adminName: v.string(), clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const lastTx = await ctx.db
      .query("transactions")
      .withIndex("by_createdAt")
      .order("desc")
      .first();
    if (!lastTx) return null;
    return await applyPoints(
      ctx,
      lastTx.studentId,
      -lastTx.amount,
      "MANUAL",
      `Undo: ${lastTx.description ?? ""}`,
      args.adminName,
      args.clientId
    );
  },
});

export const lastTransaction = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const tx = await ctx.db
      .query("transactions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .first();
    if (!tx) return null;
    return { amount: tx.amount, description: tx.description ?? "" };
  },
});

export const recent = query({
  args: { sinceMs: v.number() },
  handler: async (ctx, { sinceMs }) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", sinceMs))
      .collect();
  },
});

export const latest = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 20);
  },
});

// Range leaderboard: aggregates the transactions ledger, so a "today" board
// resets naturally at midnight while lifetime totals stay untouched — every
// past day remains queryable by its ms range.
// "Reset for the day": clear the Today board without touching season totals,
// XP, medals, or gear. Just stamps a marker earnedBetween reads for the DAY view.
export const markDayReset = mutation({
  args: { adminName: v.string() },
  handler: async (ctx, { adminName }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "day_reset_at"))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { value: String(now), updatedAt: now });
    else await ctx.db.insert("appSettings", { key: "day_reset_at", value: String(now), updatedAt: now });
    await logActivity(ctx, {
      type: "SYSTEM",
      message: "Today's points board cleared for a new day (season totals kept)",
      adminName,
    });
    return { ok: true };
  },
});

export const earnedBetween = query({
  args: { startMs: v.number(), endMs: v.optional(v.number()), applyDayReset: v.optional(v.boolean()) },
  handler: async (ctx, { startMs, endMs, applyDayReset }) => {
    // The Today board can be manually cleared without touching totals: a coach
    // "reset for the day" stamps a marker; if it's newer than the window start,
    // Today counts only points earned since the reset. Season/Week ignore it.
    let effectiveStart = startMs;
    if (applyDayReset) {
      const row = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "day_reset_at"))
        .unique();
      const marker = row ? Number(row.value) : NaN;
      if (!Number.isNaN(marker) && marker > effectiveStart) effectiveStart = marker;
    }
    // Season/full reset boundary: a POINTS or FULL reset (resets.execute) stamps
    // this, and NO range (Today/Week/Season) counts anything earned before it —
    // so standings + Hall of Fame drop to zero on reset. Applied to every range,
    // not just Today, and without deleting the ledger history.
    {
      const seasonRow = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "season_reset_at"))
        .unique();
      const seasonMarker = seasonRow ? Number(seasonRow.value) : NaN;
      if (!Number.isNaN(seasonMarker) && seasonMarker > effectiveStart) effectiveStart = seasonMarker;
    }
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_createdAt", (q) =>
        endMs !== undefined
          ? q.gte("createdAt", effectiveStart).lte("createdAt", endMs)
          : q.gte("createdAt", effectiveStart)
      )
      .collect();

    // Only real earnings count on the daily/weekly boards: coach and game
    // awards, check-ins, around-town earning, and jackpot gifts. System
    // corrections, refunds, and shop churn would otherwise inflate the range
    // totals past the season view.
    const byStudent = new Map<Id<"students">, { earned: number; net: number }>();
    for (const t of txs) {
      const row = byStudent.get(t.studentId) ?? { earned: 0, net: 0 };
      if (t.amount > 0 && XP_SOURCES.includes(t.sourceType)) row.earned += t.amount;
      row.net += t.amount;
      byStudent.set(t.studentId, row);
    }

    const students = [];
    const houseTotals: Record<string, number> = {};
    for (const [studentId, agg] of byStudent) {
      const s = await ctx.db.get(studentId);
      if (!s) continue;
      // Archived (departed) athletes STILL count toward the house season total,
      // so the team keeps their points, but they drop off the individual board.
      houseTotals[s.houseId] = (houseTotals[s.houseId] ?? 0) + agg.earned;
      if (s.archived) continue;
      students.push({
        studentId,
        fullName: s.fullName,
        gamerTag: s.gamerTag,
        displayPreference: s.displayPreference,
        avatarUrl: s.avatarUrl,
        houseId: s.houseId,
        rankId: s.rankId,
        earned: agg.earned,
        net: agg.net,
        totalPoints: s.points,
        // Identity extras so range boards render the same avatar + Volt level
        totalXp: s.totalXp ?? 0,
        avatarMode: s.avatarMode,
        avatarLook: s.avatarLook,
        isPresent: s.isPresent,
        gearEquipped: s.gearEquipped ?? null,
      });
    }
    students.sort((a, b) => b.earned - a.earned);
    return { students, houseTotals };
  },
});
