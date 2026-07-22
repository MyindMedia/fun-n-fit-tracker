import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireParent } from "./helpers";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

// Parent News inbox: published announcements, this parent's own kids' level-ups
// and awards, and coach messages — one merged, newest-first feed with per-item
// read receipts so the tab badge and the home-screen app badge can count what
// is still unread.

const PREVIEW_LEN = 140;
const ALERT_TYPES = new Set(["RANK_UP", "MEDAL", "BADGE_EARNED"]);

export type NewsKind = "ANNOUNCEMENT" | "WIN" | "MESSAGE";

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

async function conversationFor(
  ctx: QueryCtx,
  parentId: Id<"parents">
): Promise<Doc<"conversations"> | null> {
  return await ctx.db
    .query("conversations")
    .withIndex("by_parent", (q) => q.eq("parentId", parentId))
    .first();
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
      senderName: string | null;
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
        senderName: null,
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
        senderName: null,
      });
    }

    // Coach messages, so a new message is visible (and openable) from the inbox.
    const convo = await conversationFor(ctx, parent._id);
    if (convo) {
      const staffMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
        .order("desc")
        .take(40);
      for (const m of staffMessages) {
        if (m.senderType !== "STAFF") continue;
        const id = m._id as string;
        items.push({
          id,
          kind: "MESSAGE",
          title: m.senderName || "Fun 'N Fit Team",
          body: m.body,
          preview: trim(m.body),
          timestamp: m.createdAt,
          read: seen.has(id),
          priority: null,
          studentName: null,
          avatarUrl: null,
          senderName: m.senderName || "Fun 'N Fit Team",
        });
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);

    const unreadTotal = items.filter((i) => !i.read).length;
    const unreadMessages = items.filter((i) => i.kind === "MESSAGE" && !i.read).length;

    return { items, unreadTotal, unreadMessages };
  },
});

// A message is unread until the parent reads it in the inbox OR opens the
// Messages tab, so the conversation counter is derived from the read receipts
// rather than tracked separately — one source of truth, no drift.
export async function resyncConversationUnread(
  ctx: MutationCtx,
  parentId: Id<"parents">
): Promise<void> {
  const convo = await conversationFor(ctx, parentId);
  if (!convo) return;
  const seen = await readIds(ctx, parentId);
  const staffMessages = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
    .order("desc")
    .take(200);
  const unread = staffMessages.filter(
    (m) => m.senderType === "STAFF" && !seen.has(m._id as string)
  ).length;
  if (unread !== convo.unreadForParent) {
    await ctx.db.patch(convo._id, { unreadForParent: unread });
  }
}

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
    await resyncConversationUnread(ctx, parent._id);
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
    await resyncConversationUnread(ctx, parent._id);
    return { ok: true };
  },
});
