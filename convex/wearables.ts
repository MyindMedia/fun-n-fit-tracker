import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("wearables").collect();
    return docs.map((w) => ({
      id: w.key,
      name: w.name,
      slot: w.slot,
      filePath: w.filePath,
      rarity: w.rarity,
      xpCost: w.xpCost,
      isDefault: w.isDefault,
    }));
  },
});

export const getAvatar = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const doc = await ctx.db
      .query("studentAvatars")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .unique();
    if (!doc) return {};
    return {
      baseFaceId: doc.baseFaceId ?? undefined,
      hairstyleId: doc.hairstyleId ?? undefined,
      topId: doc.topId ?? undefined,
      accessoryId: doc.accessoryId ?? undefined,
    };
  },
});

export const saveAvatar = mutation({
  args: {
    studentId: v.id("students"),
    baseFaceId: v.optional(v.string()),
    hairstyleId: v.optional(v.string()),
    topId: v.optional(v.string()),
    accessoryId: v.optional(v.string()),
  },
  handler: async (ctx, { studentId, ...config }) => {
    const existing = await ctx.db
      .query("studentAvatars")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...config, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("studentAvatars", {
        studentId,
        ...config,
        updatedAt: Date.now(),
      });
    }
  },
});
