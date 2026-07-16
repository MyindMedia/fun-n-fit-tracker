import { mutation } from "./_generated/server";
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
