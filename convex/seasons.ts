import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("seasons")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    return docs.map((s) => ({
      id: s._id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate ?? undefined,
      status: s.status,
      isActive: s.isActive,
      theme: s.theme ?? "",
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    startDate: v.string(),
    theme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("seasons", {
      name: args.name,
      startDate: args.startDate,
      theme: args.theme,
      status: "ACTIVE",
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const end = mutation({
  args: { id: v.id("seasons") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      status: "COMPLETED",
      isActive: false,
      endDate: new Date().toISOString(),
    });
  },
});
