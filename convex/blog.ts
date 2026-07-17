import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const audience = v.union(
  v.literal("ALL"),
  v.literal("STUDENTS"),
  v.literal("PARENTS"),
  v.literal("COACHES"),
  v.literal("ADMINS")
);
const priority = v.union(v.literal("LOW"), v.literal("NORMAL"), v.literal("HIGH"));

function mapPost(p: {
  _id: string;
  title: string;
  content: string;
  excerpt?: string | null;
  authorId?: string | null;
  isPublished: boolean;
  publishedAt?: number | null;
  targetAudience: "ALL" | "STUDENTS" | "PARENTS" | "COACHES" | "ADMINS";
  priority: "LOW" | "NORMAL" | "HIGH";
  createdAt: number;
}) {
  return {
    id: p._id,
    title: p.title,
    content: p.content,
    excerpt: p.excerpt ?? undefined,
    authorId: p.authorId ?? undefined,
    isPublished: p.isPublished,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
    targetAudience: p.targetAudience,
    priority: p.priority,
    createdAt: new Date(p.createdAt).toISOString(),
  };
}

export const published = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("blogPosts")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .order("desc")
      .collect();
    return docs.map(mapPost);
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("blogPosts")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    return docs.map(mapPost);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    targetAudience: v.optional(audience),
    priority: v.optional(priority),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("blogPosts", {
      title: args.title,
      content: args.content,
      excerpt: args.excerpt,
      targetAudience: args.targetAudience ?? "ALL",
      priority: args.priority ?? "NORMAL",
      isPublished: args.isPublished ?? false,
      publishedAt: args.isPublished ? Date.now() : undefined,
      createdAt: Date.now(),
    });
    // Team alert notification when a post goes out published
    if (args.isPublished) {
      await ctx.scheduler.runAfter(0, internal.pushNode.deliver, {
        title: `Team alert: ${args.title}`,
        body: args.excerpt || args.content.slice(0, 120),
        url: "/#/",
        tag: "fnf-alert",
      });
    }
  },
});

export const update = mutation({
  args: {
    id: v.id("blogPosts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    targetAudience: v.optional(audience),
    priority: v.optional(priority),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) patch[k] = val;
    }
    if (updates.isPublished) patch.publishedAt = Date.now();
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
