import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getRankList } from "./helpers";
import { BADGES, REWARDS, GAME_LIBRARY } from "../constants";

// ── Ranks ────────────────────────────────────────────────────────────────────

export const ranks = query({
  args: {},
  handler: async (ctx) => getRankList(ctx),
});

export const createRank = mutation({
  args: {
    name: v.string(),
    threshold: v.number(),
    icon: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsRequired: v.optional(v.number()),
    criteriaTasks: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const key = `r_${args.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Math.floor(
      Math.random() * 100000
    )}`;
    await ctx.db.insert("ranks", {
      key,
      name: args.name,
      threshold: args.threshold,
      icon: args.icon,
      color: args.color,
      description: args.description,
      xpReward: args.xpReward ?? 0,
      pointsRequired: args.pointsRequired ?? args.threshold,
      criteriaTasks: args.criteriaTasks ?? [],
    });
  },
});

export const updateRank = mutation({
  args: {
    key: v.string(),
    name: v.optional(v.string()),
    threshold: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsRequired: v.optional(v.number()),
    criteriaTasks: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { key, ...updates }) => {
    const doc = await ctx.db
      .query("ranks")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!doc) throw new Error(`Rank ${key} not found`);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) patch[k] = val;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(doc._id, patch);
  },
});

export const deleteRank = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const doc = await ctx.db
      .query("ranks")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (doc) await ctx.db.delete(doc._id);
  },
});

// ── Badges / rewards / game library (with bundled fallbacks) ────────────────

export const badges = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("badges").collect();
    if (docs.length === 0) return BADGES;
    return docs.map((b) => ({
      id: b.key,
      name: b.name,
      icon: b.icon,
      description: b.description ?? "",
      color: b.color ?? "#60a5fa",
    }));
  },
});

export const rewards = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("rewards").collect();
    if (docs.length === 0) return REWARDS;
    return docs
      .map((r) => ({
        id: r.key,
        name: r.name,
        cost: r.cost,
        icon: r.icon,
        category: r.category,
        description: r.description ?? "",
      }))
      .sort((a, b) => a.cost - b.cost);
  },
});

export const gameLibrary = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("gameLibrary").collect();
    if (docs.length === 0) return GAME_LIBRARY;
    return docs.map(({ _id, _creationTime, ...def }) => def);
  },
});

// ── Trophies ─────────────────────────────────────────────────────────────────

export const trophies = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("trophies")
      .withIndex("by_pointsRequired")
      .collect();
    return docs.map((t) => ({
      id: t._id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      xpReward: t.xpReward,
      pointsRequired: t.pointsRequired,
      criteriaTasks: t.criteriaTasks,
      color: t.color,
      isActive: t.isActive,
      createdAt: new Date(t.createdAt).toISOString(),
    }));
  },
});

export const createTrophy = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    icon: v.string(),
    xpReward: v.number(),
    pointsRequired: v.number(),
    criteriaTasks: v.array(v.string()),
    color: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("trophies", { ...args, createdAt: Date.now() });
  },
});

export const updateTrophy = mutation({
  args: {
    id: v.id("trophies"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsRequired: v.optional(v.number()),
    criteriaTasks: v.optional(v.array(v.string())),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) patch[k] = val;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const deleteTrophy = mutation({
  args: { id: v.id("trophies") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
