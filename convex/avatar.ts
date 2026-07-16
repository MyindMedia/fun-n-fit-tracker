import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { AVATAR_ITEMS, HAIR_COLORS, SKIN_TONES, avatarItem } from "../avatarCatalog";

// Layered-avatar look + photo/avatar mode. The look lives on the students row
// (no joins on boards); ownership is validated against studentWearables.

const lookValidator = v.object({
  skin: v.optional(v.string()),
  hairColor: v.optional(v.string()),
  hair: v.optional(v.string()),
  top: v.optional(v.string()),
  acc: v.optional(v.union(v.string(), v.null())),
});

export const ownedWearables = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const rows = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    return rows.map((r) => ({ key: r.wearableId, upgradeLevel: r.upgradeLevel ?? 0 }));
  },
});

export const saveLook = mutation({
  args: { studentId: v.id("students"), look: lookValidator },
  handler: async (ctx, { studentId, look }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    if (look.skin && !SKIN_TONES.some((t) => t.id === look.skin)) {
      throw new Error("Unknown skin tone");
    }
    if (look.hairColor && !HAIR_COLORS.includes(look.hairColor)) {
      throw new Error("Unknown hair color");
    }

    // Equipped items must exist and be default or owned
    const owned = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const ownedKeys = new Set(owned.map((r) => r.wearableId));
    for (const key of [look.hair, look.top, look.acc]) {
      if (!key) continue;
      const item = avatarItem(key);
      if (!item) throw new Error(`Unknown item: ${key}`);
      if (!item.isDefault && !ownedKeys.has(key)) {
        throw new Error(`${item.name} is not unlocked yet`);
      }
    }

    await ctx.db.patch(studentId, {
      avatarLook: {
        skin: look.skin,
        hairColor: look.hairColor,
        hair: look.hair,
        top: look.top,
        acc: look.acc ?? null,
      },
      avatarMode: "AVATAR", // saving a look opts into showing it
    });
  },
});

export const setMode = mutation({
  args: {
    studentId: v.id("students"),
    mode: v.union(v.literal("PHOTO"), v.literal("AVATAR")),
  },
  handler: async (ctx, { studentId, mode }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    await ctx.db.patch(studentId, { avatarMode: mode });
  },
});

// Catalog straight from the shared registry (wearables table mirrors it for
// legacy surfaces; this is the authoritative list for the studio/crates UI).
export const catalog = query({
  args: {},
  handler: async () => AVATAR_ITEMS,
});
