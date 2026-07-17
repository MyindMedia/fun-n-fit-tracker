import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Web push subscriptions + fan-out scheduling. The actual delivery runs in
// convex/pushNode.ts (node runtime, web-push library). Triggers live where
// things happen: games.start (game alerts) and blog publishing (team alerts).

export const subscribe = mutation({
  args: {
    subscription: v.string(), // JSON.stringify(PushSubscription)
    audience: v.union(v.literal("PARENT"), v.literal("ADMIN"), v.literal("STUDENT")),
    parentId: v.optional(v.union(v.id("parents"), v.null())),
    label: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    let endpoint = "";
    try {
      endpoint = (JSON.parse(args.subscription) as { endpoint?: string }).endpoint ?? "";
    } catch {
      throw new Error("Bad subscription payload");
    }
    if (!endpoint) throw new Error("Subscription has no endpoint");
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        subscription: args.subscription,
        audience: args.audience,
        parentId: args.parentId ?? existing.parentId,
        label: args.label ?? existing.label,
      });
      return { ok: true, updated: true };
    }
    await ctx.db.insert("pushSubscriptions", {
      endpoint,
      subscription: args.subscription,
      audience: args.audience,
      parentId: args.parentId,
      label: args.label,
      createdAt: Date.now(),
    });
    return { ok: true, created: true };
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

export const isSubscribed = query({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    return { subscribed: !!existing };
  },
});

// All stored subscriptions, for the delivery action.
export const allSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("pushSubscriptions").collect();
    return rows.map((r) => ({
      endpoint: r.endpoint,
      subscription: r.subscription,
      parentId: r.parentId ?? null,
    }));
  },
});

// Delivery reported these endpoints dead (404/410): drop them.
export const pruneDead = internalMutation({
  args: { endpoints: v.array(v.string()) },
  handler: async (ctx, { endpoints }) => {
    for (const endpoint of endpoints) {
      const row = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    return { pruned: endpoints.length };
  },
});

// Admin test: fire a notification at every subscribed device.
export const sendTest = mutation({
  args: { byAdmin: v.string() },
  handler: async (ctx, { byAdmin }) => {
    await ctx.scheduler.runAfter(0, internal.pushNode.deliver, {
      title: "Fun 'N Fit test alert",
      body: `Notifications are working. Sent by ${byAdmin}.`,
      url: "/#/live",
      tag: "fnf-test",
    });
    return { ok: true };
  },
});
