import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { houseId } from "./schema";
import { applyPoints, logActivity } from "./helpers";
import { HOUSES } from "../constants";

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
            args.clientId
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
        args.clientId
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
            args.clientId
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
export const earnedBetween = query({
  args: { startMs: v.number(), endMs: v.optional(v.number()) },
  handler: async (ctx, { startMs, endMs }) => {
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_createdAt", (q) =>
        endMs !== undefined
          ? q.gte("createdAt", startMs).lte("createdAt", endMs)
          : q.gte("createdAt", startMs)
      )
      .collect();

    const byStudent = new Map<Id<"students">, { earned: number; net: number }>();
    for (const t of txs) {
      const row = byStudent.get(t.studentId) ?? { earned: 0, net: 0 };
      if (t.amount > 0) row.earned += t.amount;
      row.net += t.amount;
      byStudent.set(t.studentId, row);
    }

    const students = [];
    const houseTotals: Record<string, number> = {};
    for (const [studentId, agg] of byStudent) {
      const s = await ctx.db.get(studentId);
      if (!s) continue;
      houseTotals[s.houseId] = (houseTotals[s.houseId] ?? 0) + agg.earned;
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
      });
    }
    students.sort((a, b) => b.earned - a.earned);
    return { students, houseTotals };
  },
});
