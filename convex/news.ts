import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireParent } from "./helpers";
import { Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

// Parent News inbox: published announcements plus this parent's own kids'
// level-ups and awards, newest first, with per-item read receipts so the News
// tab badge can count what is still unread. Coach messages live in their own
// Messages tab and are counted separately — the two never mix.

const PREVIEW_LEN = 140;
const ALERT_TYPES = new Set(["RANK_UP", "MEDAL", "BADGE_EARNED"]);

export type NewsKind = "ANNOUNCEMENT" | "WIN";

const trim = (text: string): string =>
  text.length > PREVIEW_LEN ? `${text.slice(0, PREVIEW_LEN).trimEnd()}…` : text;

// Every id this parent has already read, as a set for O(1) lookups.
async function readIds(ctx: QueryCtx, parentId: Id<"parents">): Promise<Set<string>> {
  const rows = await ctx.db
    .query("parentNewsReads")
    .withIndex("by_parent", (q) => q.eq("parentId", parentId))
    .collect();
  return new Set(rows.map((r) => r.itemId));
}

export const forParent = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const parent = await requireParent(ctx, sessionToken);
    const seen = await readIds(ctx, parent._id);

    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .collect();
    const kidIds = new Set(links.map((l) => l.studentId as string));

    type Item = {
      id: string;
      kind: NewsKind;
      title: string;
      body: string;
      preview: string;
      timestamp: number;
      read: boolean;
      priority: string | null;
      studentName: string | null;
      avatarUrl: string | null;
    };
    const items: Item[] = [];

    // Announcements everyone / parents see.
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .order("desc")
      .take(30);
    for (const p of posts) {
      if (p.targetAudience !== "ALL" && p.targetAudience !== "PARENTS") continue;
      const id = p._id as string;
      items.push({
        id,
        kind: "ANNOUNCEMENT",
        title: p.title,
        body: p.content,
        preview: trim(p.excerpt || p.content),
        timestamp: p.publishedAt ?? p.createdAt,
        read: seen.has(id),
        priority: p.priority,
        studentName: null,
        avatarUrl: null,
      });
    }

    // This parent's kids' level-ups + awards from the activity ledger.
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_timestamp")
      .order("desc")
      .take(150);
    const wins = recent
      .filter((n) => n.studentId && kidIds.has(n.studentId) && ALERT_TYPES.has(n.type))
      .slice(0, 40);
    for (const n of wins) {
      const id = n._id as string;
      items.push({
        id,
        kind: "WIN",
        title: n.studentName ? `${n.studentName} — ${n.type.replace(/_/g, " ")}` : n.type,
        body: n.message,
        preview: trim(n.message),
        timestamp: n.timestamp,
        read: seen.has(id),
        priority: null,
        studentName: n.studentName ?? null,
        avatarUrl: n.avatarUrl ?? null,
      });
    }

    items.sort((a, b) => b.timestamp - a.timestamp);

    return { items, unreadTotal: items.filter((i) => !i.read).length };
  },
});

export const markRead = mutation({
  args: { sessionToken: v.string(), itemIds: v.array(v.string()) },
  handler: async (ctx, { sessionToken, itemIds }) => {
    const parent = await requireParent(ctx, sessionToken);
    if (itemIds.length === 0) return { marked: 0 };
    const now = Date.now();
    let marked = 0;
    for (const itemId of new Set(itemIds)) {
      const existing = await ctx.db
        .query("parentNewsReads")
        .withIndex("by_parent_item", (q) =>
          q.eq("parentId", parent._id).eq("itemId", itemId)
        )
        .first();
      if (existing) continue;
      await ctx.db.insert("parentNewsReads", { parentId: parent._id, itemId, readAt: now });
      marked++;
    }
    return { marked };
  },
});

// Undo for a single item, so a parent can flag something to come back to.
export const markUnread = mutation({
  args: { sessionToken: v.string(), itemIds: v.array(v.string()) },
  handler: async (ctx, { sessionToken, itemIds }) => {
    const parent = await requireParent(ctx, sessionToken);
    for (const itemId of new Set(itemIds)) {
      const existing = await ctx.db
        .query("parentNewsReads")
        .withIndex("by_parent_item", (q) =>
          q.eq("parentId", parent._id).eq("itemId", itemId)
        )
        .first();
      if (existing) await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});
