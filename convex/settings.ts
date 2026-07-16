import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const all = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("appSettings").collect();
    return docs.map((d) => ({ key: d.key, value: d.value }));
  },
});

export const upsert = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appSettings", { key, value, updatedAt: Date.now() });
    }
  },
});
