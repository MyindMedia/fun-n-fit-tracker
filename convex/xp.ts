import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Port of the Postgres award_xp() RPC: record the XP transaction and
// increment the student's lifetime XP atomically.
export const award = mutation({
  args: {
    studentId: v.id("students"),
    amount: v.number(),
    sourceType: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    await ctx.db.insert("xpTransactions", {
      studentId: args.studentId,
      amount: args.amount,
      sourceType: args.sourceType,
      description: args.description,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.studentId, {
      totalXp: (student.totalXp ?? 0) + args.amount,
    });
  },
});

// Full XP ledger for one athlete, newest first. Powers the "Daily XP" history
// on the stats report (grouped by day client-side). Each row is one earning
// event: amount + where it came from (sourceType) + its description.
export const historyForStudent = query({
  args: { studentId: v.id("students"), limit: v.optional(v.number()) },
  handler: async (ctx, { studentId, limit }) => {
    const rows = await ctx.db
      .query("xpTransactions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(limit ?? 250);
    return rows.map((r) => ({
      id: r._id,
      amount: r.amount,
      sourceType: r.sourceType,
      description: r.description ?? "",
      createdAt: r.createdAt,
    }));
  },
});
