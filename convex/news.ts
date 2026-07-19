import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireParent } from "./helpers";

// Parent News feed: the published announcements everyone/parents can see, plus
// THIS parent's own kids' level-ups and awards. Gives the transient pop-up
// notifications a persistent home so a parent can scroll back through them.
export const forParent = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const parent = await requireParent(ctx, sessionToken);
    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .collect();
    const kidIds = new Set(links.map((l) => l.studentId as string));

    // Announcements everyone / parents see, newest first.
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .order("desc")
      .take(30);
    const announcements = posts
      .filter((p) => p.targetAudience === "ALL" || p.targetAudience === "PARENTS")
      .map((p) => ({
        id: p._id as string,
        title: p.title,
        excerpt: p.excerpt ?? "",
        content: p.content,
        priority: p.priority,
        publishedAt: p.publishedAt ?? p.createdAt,
      }));

    // This parent's kids' level-ups + awards from the activity ledger.
    const ALERT_TYPES = new Set(["RANK_UP", "MEDAL", "BADGE_EARNED"]);
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_timestamp")
      .order("desc")
      .take(150);
    const alerts = recent
      .filter((n) => n.studentId && kidIds.has(n.studentId) && ALERT_TYPES.has(n.type))
      .slice(0, 40)
      .map((n) => ({
        id: n._id as string,
        type: n.type,
        studentName: n.studentName ?? "",
        avatarUrl: n.avatarUrl ?? null,
        message: n.message,
        timestamp: n.timestamp,
      }));

    return { announcements, alerts };
  },
});
