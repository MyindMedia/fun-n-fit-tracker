import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireParent } from "./helpers";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const PREVIEW_LEN = 80;

async function getOrCreateConversation(
  ctx: MutationCtx,
  parentId: Id<"parents">
): Promise<Id<"conversations">> {
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_parent", (q) => q.eq("parentId", parentId))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("conversations", {
    parentId,
    lastMessageAt: Date.now(),
    lastMessagePreview: "",
    unreadForParent: 0,
    unreadForStaff: 0,
    createdAt: Date.now(),
  });
}

export const sendFromParent = mutation({
  args: { sessionToken: v.string(), body: v.string() },
  handler: async (ctx, { sessionToken, body }) => {
    const text = body.trim();
    if (!text) throw new Error("Message is empty");
    const parent = await requireParent(ctx, sessionToken);
    const conversationId = await getOrCreateConversation(ctx, parent._id);
    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId,
      senderType: "PARENT",
      senderName: parent.fullName,
      body: text,
      createdAt: now,
    });
    const convo = (await ctx.db.get(conversationId))!;
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: text.slice(0, PREVIEW_LEN),
      unreadForStaff: convo.unreadForStaff + 1,
    });
    return { conversationId };
  },
});

export const sendFromStaff = mutation({
  args: {
    parentId: v.id("parents"),
    body: v.string(),
    adminName: v.string(),
  },
  handler: async (ctx, { parentId, body, adminName }) => {
    const text = body.trim();
    if (!text) throw new Error("Message is empty");
    const parent = await ctx.db.get(parentId);
    if (!parent) throw new Error("Parent not found");
    const conversationId = await getOrCreateConversation(ctx, parentId);
    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId,
      senderType: "STAFF",
      senderName: adminName,
      body: text,
      createdAt: now,
    });
    const convo = (await ctx.db.get(conversationId))!;
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: text.slice(0, PREVIEW_LEN),
      unreadForParent: convo.unreadForParent + 1,
    });
    // Ping only this family's devices.
    await ctx.scheduler.runAfter(0, internal.pushNode.deliver, {
      title: `Message from Coach ${adminName}`,
      body: text.slice(0, 140),
      url: "/#/parent-dashboard",
      tag: "fnf-message",
      parentIds: [parentId as string],
    });
    return { conversationId };
  },
});

// Admin inbox: all conversations, most recent first, with parent identity.
export const staffInbox = query({
  args: {},
  handler: async (ctx) => {
    const convos = await ctx.db
      .query("conversations")
      .withIndex("by_lastMessageAt")
      .order("desc")
      .collect();
    const out = [];
    for (const convo of convos) {
      const parent = await ctx.db.get(convo.parentId);
      if (!parent) continue;
      out.push({
        conversation: convo,
        parent: { id: parent._id, fullName: parent.fullName, email: parent.email },
      });
    }
    return out;
  },
});

// Parent portal: their conversation (may be null before first message).
export const threadForParent = query({
  args: { sessionToken: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, limit }) => {
    const parent = await requireParent(ctx, sessionToken);
    const convo = await ctx.db
      .query("conversations")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .first();
    if (!convo) return { conversation: null, messages: [] };
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
      .order("desc")
      .take(limit ?? 100);
    return { conversation: convo, messages: messages.reverse() };
  },
});

export const messagesFor = query({
  args: { conversationId: v.id("conversations"), limit: v.optional(v.number()) },
  handler: async (ctx, { conversationId, limit }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(limit ?? 100);
    return messages.reverse();
  },
});

export const markReadByParent = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const parent = await requireParent(ctx, sessionToken);
    const convo = await ctx.db
      .query("conversations")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .first();
    if (convo && convo.unreadForParent > 0) {
      await ctx.db.patch(convo._id, { unreadForParent: 0 });
    }
  },
});

export const markReadByStaff = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const convo = await ctx.db.get(conversationId);
    if (convo && convo.unreadForStaff > 0) {
      await ctx.db.patch(conversationId, { unreadForStaff: 0 });
    }
  },
});
