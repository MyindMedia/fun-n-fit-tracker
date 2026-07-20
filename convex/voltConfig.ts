// Admin-editable Volt configuration: the 40 XP level thresholds and per-perk
// unlock levels. Stored as a single JSON string in appSettings under the key
// "volt_config". A missing row means "use the code-formula defaults" — the
// client (App bootstrap) and server (helpers.applyPoints / volt.ts) both apply
// it through voltCatalog's guarded applyVoltConfig / resetVoltConfig, so a bad
// or absent config can never break the live XP/level system.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { VOLT_MAX_LEVEL, isValidVoltLevels } from "../voltCatalog";

export const VOLT_CONFIG_KEY = "volt_config";

// Returns the raw JSON string, or null when no override has been saved.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", VOLT_CONFIG_KEY))
      .unique();
    return row ? row.value : null;
  },
});

// Save an override. Validates the levels array server-side (40 ascending,
// non-negative numbers) and rejects anything else so a corrupt config can
// never be persisted. perkUnlocks is a best-effort map; out-of-range entries
// are ignored when applied.
export const set = mutation({
  args: {
    levels: v.array(v.number()),
    perkUnlocks: v.optional(v.record(v.string(), v.number())),
  },
  handler: async (ctx, { levels, perkUnlocks }) => {
    if (!isValidVoltLevels(levels)) {
      throw new Error(
        `Volt levels must be exactly ${VOLT_MAX_LEVEL} ascending, non-negative numbers`
      );
    }
    const value = JSON.stringify({ levels, perkUnlocks: perkUnlocks ?? {} });
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", VOLT_CONFIG_KEY))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appSettings", {
        key: VOLT_CONFIG_KEY,
        value,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
