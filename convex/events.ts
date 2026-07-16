import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { publishEvent } from "./helpers";

// Cross-client broadcast bus (replaces Supabase broadcast channels).
export const publish = mutation({
  args: {
    kind: v.string(),
    payload: v.any(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { kind, payload, source }) => {
    await publishEvent(ctx, kind, payload, source);
  },
});

// Subscribed by every client; returns the most recent events so the client can
// diff by _id and dispatch anything newer than its connect time.
export const latest = query({
  args: { sinceTs: v.number() },
  handler: async (ctx, { sinceTs }) => {
    return await ctx.db
      .query("appEvents")
      .withIndex("by_ts", (q) => q.gt("ts", sinceTs))
      .order("asc")
      .take(100);
  },
});
