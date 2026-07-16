import { mutation } from "./_generated/server";
import { RANKS, BADGES, REWARDS, GAME_LIBRARY } from "../constants";
import { AVATAR_ITEMS } from "../avatarCatalog";

// Idempotent catalog seed: ranks, badges, rewards, and the game library from
// the bundled constants. Safe to run repeatedly (skips existing keys).
export const catalog = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;

    for (const rank of RANKS) {
      const existing = await ctx.db
        .query("ranks")
        .withIndex("by_key", (q) => q.eq("key", rank.id))
        .unique();
      if (existing) continue;
      await ctx.db.insert("ranks", {
        key: rank.id,
        name: rank.name,
        threshold: rank.threshold,
        icon: rank.icon,
        color: rank.color,
        description: rank.description,
        xpReward: rank.xpReward ?? 0,
        pointsRequired: rank.pointsRequired ?? rank.threshold,
        criteriaTasks: rank.criteriaTasks ?? [],
        type: rank.type ?? "RANK",
      });
      inserted++;
    }

    for (const badge of BADGES) {
      const existing = await ctx.db
        .query("badges")
        .withIndex("by_key", (q) => q.eq("key", badge.id))
        .unique();
      if (existing) continue;
      await ctx.db.insert("badges", {
        key: badge.id,
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        color: badge.color,
      });
      inserted++;
    }

    for (const reward of REWARDS) {
      const existing = await ctx.db
        .query("rewards")
        .withIndex("by_key", (q) => q.eq("key", reward.id))
        .unique();
      if (existing) continue;
      await ctx.db.insert("rewards", {
        key: reward.id,
        name: reward.name,
        cost: reward.cost,
        icon: reward.icon,
        category: reward.category,
        description: reward.description,
      });
      inserted++;
    }

    for (const game of GAME_LIBRARY) {
      const existing = await ctx.db
        .query("gameLibrary")
        .withIndex("by_gameKey", (q) => q.eq("gameKey", game.gameKey))
        .unique();
      if (existing) continue;
      await ctx.db.insert("gameLibrary", {
        gameKey: game.gameKey,
        displayName: game.displayName,
        category: game.category,
        houseTraitFocus: game.houseTraitFocus,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        recommendedAgeBand: game.recommendedAgeBand,
        durationDefaultSeconds: game.durationDefaultSeconds,
        equipmentChecklist: game.equipmentChecklist,
        setupSteps: game.setupSteps,
        rules: game.rules,
        scoringRules: game.scoringRules,
        penalties: game.penalties,
        tieBreaker: game.tieBreaker,
        safetyNotes: game.safetyNotes,
        accessibilityVariants: game.accessibilityVariants,
        coachScriptShort: game.coachScriptShort,
        dataCaptureFields: game.dataCaptureFields,
        leaderboardMetric: game.leaderboardMetric,
        templateId: game.templateId,
      });
      inserted++;
    }

    return { inserted };
  },
});

// Upsert the game library from the bundled constants — unlike `catalog`,
// existing games are UPDATED, so rule/scoring edits (e.g. NFC variants)
// propagate. Run after changing GAME_LIBRARY: npx convex run seed:refreshGames
// Upsert the avatar item catalog into the wearables table (keeps the legacy
// list/purchase surfaces working; the SVG rig renders by key, filePath unused).
export const wearables = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const item of AVATAR_ITEMS) {
      const fields = {
        key: item.key,
        name: item.name,
        slot: item.slot,
        filePath: "",
        rarity: item.rarity,
        xpCost: item.cost,
        isDefault: item.isDefault ?? false,
      };
      const existing = await ctx.db
        .query("wearables")
        .withIndex("by_key", (q) => q.eq("key", item.key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, fields);
        updated++;
      } else {
        await ctx.db.insert("wearables", fields);
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

export const refreshGames = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const game of GAME_LIBRARY) {
      const fields = {
        gameKey: game.gameKey,
        displayName: game.displayName,
        category: game.category,
        houseTraitFocus: game.houseTraitFocus,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        recommendedAgeBand: game.recommendedAgeBand,
        durationDefaultSeconds: game.durationDefaultSeconds,
        equipmentChecklist: game.equipmentChecklist,
        setupSteps: game.setupSteps,
        rules: game.rules,
        scoringRules: game.scoringRules,
        penalties: game.penalties,
        tieBreaker: game.tieBreaker,
        safetyNotes: game.safetyNotes,
        accessibilityVariants: game.accessibilityVariants,
        coachScriptShort: game.coachScriptShort,
        dataCaptureFields: game.dataCaptureFields,
        leaderboardMetric: game.leaderboardMetric,
        templateId: game.templateId,
      };
      const existing = await ctx.db
        .query("gameLibrary")
        .withIndex("by_gameKey", (q) => q.eq("gameKey", game.gameKey))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, fields);
        updated++;
      } else {
        await ctx.db.insert("gameLibrary", fields);
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

// ── Game center seed ─────────────────────────────────────────────────────────
// Rarity-tiered avatar skins (DiceBear art — no custom assets needed) and a
// starter set of off-site special tasks. Idempotent: skips existing keys/titles.

const dice = (style: string, seed: string, bg: string) =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;

const AVATAR_SKINS: Array<{
  key: string;
  name: string;
  cost: number;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  description: string;
  value: string;
}> = [
  { key: "skin_rookie_bot", name: "Rookie Bot", cost: 250, icon: "🤖", rarity: "common",
    description: "Entry-level bot frame. Everyone starts somewhere.",
    value: dice("bottts", "RookieBot", "b6e3f4") },
  { key: "skin_pixel_hero", name: "Pixel Hero", cost: 250, icon: "🕹️", rarity: "common",
    description: "8-bit legend in the making.",
    value: dice("pixel-art", "PixelHero", "c0aede") },
  { key: "skin_street_ace", name: "Street Ace", cost: 500, icon: "🧢", rarity: "uncommon",
    description: "Cool under pressure, quick on the court.",
    value: dice("adventurer", "StreetAce", "ffd5dc") },
  { key: "skin_cyber_fox", name: "Cyber Fox", cost: 500, icon: "🦊", rarity: "uncommon",
    description: "Sly, fast, and always one step ahead.",
    value: dice("fun-emoji", "CyberFox", "ffdfbf") },
  { key: "skin_neon_ninja", name: "Neon Ninja", cost: 1000, icon: "🥷", rarity: "rare",
    description: "Strikes fast. Glows brighter.",
    value: dice("adventurer-neutral", "NeonNinja", "d1f4d9") },
  { key: "skin_mecha_titan", name: "Mecha Titan", cost: 2500, icon: "⚙️", rarity: "epic",
    description: "Heavy plating, heavier presence.",
    value: dice("bottts", "MechaTitan", "ffd5dc") },
  { key: "skin_shadow_dragon", name: "Shadow Dragon", cost: 5000, icon: "🐉", rarity: "legendary",
    description: "The rarest skin in the academy. Earned, never given.",
    value: dice("bottts", "ShadowDragon", "1e293b") },
];

const STARTER_TASKS: Array<{
  title: string;
  description: string;
  points: number;
  requiresProof: boolean;
}> = [
  { title: "Read for 20 minutes", points: 15, requiresProof: false,
    description: "Knock out 20 minutes of reading at home — any book counts." },
  { title: "Help with chores", points: 15, requiresProof: false,
    description: "Pitch in at home: dishes, trash, tidying your room." },
  { title: "30 minutes of outdoor play", points: 20, requiresProof: false,
    description: "Get outside and move for half an hour — bike, ball, or playground." },
];

export const gameCenter = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let patched = 0;

    for (const skin of AVATAR_SKINS) {
      const existing = await ctx.db
        .query("rewards")
        .withIndex("by_key", (q) => q.eq("key", skin.key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("rewards", {
        key: skin.key,
        name: skin.name,
        cost: skin.cost,
        icon: skin.icon,
        category: "Virtual",
        description: skin.description,
        rarity: skin.rarity,
        value: skin.value,
      });
      inserted++;
    }

    // Backfill a cost-based rarity onto pre-existing rewards so the perk shop
    // can style every card.
    const allRewards = await ctx.db.query("rewards").collect();
    for (const reward of allRewards) {
      if (reward.rarity) continue;
      const rarity =
        reward.cost >= 5000 ? "legendary"
        : reward.cost >= 2500 ? "epic"
        : reward.cost >= 1000 ? "rare"
        : reward.cost >= 500 ? "uncommon"
        : "common";
      await ctx.db.patch(reward._id, { rarity });
      patched++;
    }

    const existingTasks = await ctx.db.query("specialTasks").collect();
    for (const task of STARTER_TASKS) {
      if (existingTasks.some((t) => t.title === task.title)) continue;
      await ctx.db.insert("specialTasks", {
        title: task.title,
        description: task.description,
        points: task.points,
        isActive: true,
        requiresProof: task.requiresProof,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted, patched };
  },
});
