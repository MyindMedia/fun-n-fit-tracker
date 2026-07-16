import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { houseId } from "./schema";
import { logActivity } from "./helpers";

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 50);
  },
});

export const log = mutation({
  args: {
    type: v.string(),
    message: v.string(),
    adminName: v.optional(v.string()),
    studentId: v.optional(v.string()),
    studentName: v.optional(v.string()),
    amount: v.optional(v.number()),
    avatarUrl: v.optional(v.string()),
    houseId: v.optional(houseId),
  },
  handler: async (ctx, args) => {
    await logActivity(ctx, args);
  },
});
