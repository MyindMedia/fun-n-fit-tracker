import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { applyPoints, logActivity, publishEvent, resolveLocalDate } from "./helpers";
import { queueCelebration } from "./celebrations";

// Coach-awarded accolades. "Session Legends" is the flagship flow: at the end
// of a session, coaches pick their legends — each gets a medal row, optional
// bonus points, an activity entry, and a celebration on the live board.

export const award = mutation({
  args: {
    studentIds: v.array(v.id("students")),
    key: v.string(), // 'legend' | 'mvp' | 'hustle' | 'teamwork' | custom
    title: v.string(), // "Session Legend"
    note: v.optional(v.string()),
    bonusPoints: v.optional(v.number()),
    awardedBy: v.string(),
    localDate: v.optional(v.string()),
    gameSessionId: v.optional(v.id("gameSessions")),
  },
  handler: async (ctx, args) => {
    const date = resolveLocalDate(args.localDate);
    const results = [];
    for (const studentId of args.studentIds) {
      const student = await ctx.db.get(studentId);
      if (!student) continue;

      await ctx.db.insert("medals", {
        studentId,
        key: args.key,
        title: args.title,
        note: args.note ?? null,
        awardedBy: args.awardedBy,
        date,
        gameSessionId: args.gameSessionId,
        createdAt: Date.now(),
      });

      if (args.bonusPoints && args.bonusPoints > 0) {
        await applyPoints(
          ctx,
          studentId,
          args.bonusPoints,
          "MANUAL",
          `${args.title} medal`,
          args.awardedBy,
          undefined,
          args.gameSessionId
        );
      }

      await logActivity(ctx, {
        type: "MEDAL",
        message: `${student.fullName} earned the ${args.title} medal`,
        adminName: args.awardedBy,
        studentId,
        studentName: student.fullName,
        avatarUrl: student.avatarUrl,
      });

      // Big-board celebration (same channel as rank-ups; BADGE_EARNED renders
      // as "Earned — <title>" in CelebrationOverlay)
      await publishEvent(ctx, "rank_up", {
        type: "BADGE_EARNED",
        studentName: student.fullName,
        achievement: args.title,
        studentAvatar: student.avatarUrl,
        ts: Date.now(),
      });

      // Notify the family: queue the congrats pop-up for the kid/parent portals
      // and ping ONLY this kid's linked parents (child-specific, not everyone).
      await queueCelebration(ctx, {
        studentId,
        kind: "AWARD",
        title: args.title.toUpperCase(),
        message: `${student.fullName} earned the ${args.title}!`,
        icon: student.avatarUrl,
      });
      const links = await ctx.db
        .query("parentStudentLinks")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .collect();
      if (links.length > 0) {
        await ctx.scheduler.runAfter(0, internal.pushNode.deliver, {
          title: "New Award!",
          body: `${student.fullName} earned the ${args.title}! Open the app for the celebration.`,
          url: "/#/parent-dashboard",
          tag: "fnf-award",
          parentIds: links.map((l) => l.parentId as string),
        });
      }

      results.push({ studentId, fullName: student.fullName });
    }
    return { awarded: results.length, results };
  },
});

export const forStudent = query({
  args: { studentId: v.id("students"), limit: v.optional(v.number()) },
  handler: async (ctx, { studentId, limit }) => {
    return await ctx.db
      .query("medals")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(limit ?? 50);
  },
});

// Recent medals across the academy (superlatives wall).
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("medals")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 60);
    const out = [];
    for (const m of rows) {
      const student = await ctx.db.get(m.studentId);
      out.push({
        ...m,
        fullName: student?.fullName ?? "(removed)",
        houseId: student?.houseId ?? null,
        avatarUrl: student?.avatarUrl ?? null,
      });
    }
    return out;
  },
});

export const remove = mutation({
  args: { medalId: v.id("medals") },
  handler: async (ctx, { medalId }) => {
    await ctx.db.delete(medalId);
  },
});
