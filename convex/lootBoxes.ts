import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { applyPoints, logActivity, publishEvent, resolveLocalDate } from "./helpers";
import {
  AVATAR_ITEMS,
  LOOT_BOXES,
  LOOT_DAILY_CAP,
  MAX_UPGRADE_LEVEL,
  SHARD_REFUND_PCT,
  AvatarRarity,
} from "../avatarCatalog";
import { voltEffects } from "../voltCatalog";

// Points-only loot crates. Kid-safety rules are structural, not optional:
// points are earned by exercise (no money path), odds are published in the UI
// and enforced here, opens are capped per day, and duplicates always convert
// into upgrades or a shard refund — no dead rolls.

export const open = mutation({
  args: {
    studentId: v.id("students"),
    box: v.union(v.literal("STANDARD"), v.literal("PREMIUM")),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const boxDef = LOOT_BOXES.find((b) => b.key === args.box)!;
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");
    if (student.points < boxDef.cost) {
      throw new Error(`Not enough points — a ${boxDef.name} costs ${boxDef.cost}`);
    }

    const date = resolveLocalDate(args.localDate);
    // Volt perks/wildcards (Collector, High Roller) raise the daily crate cap.
    const volt = voltEffects(student.voltLoadout);
    const capPerDay = LOOT_DAILY_CAP + volt.crateCapPlus;
    const todays = await ctx.db
      .query("lootBoxOpens")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", date)
      )
      .collect();
    if (todays.length >= capPerDay) {
      throw new Error(`Crate limit reached — come back tomorrow! (${capPerDay}/day)`);
    }

    // Pay first (multiplier-exempt STORE_PURCHASE), then roll.
    await applyPoints(
      ctx,
      args.studentId,
      -boxDef.cost,
      "STORE_PURCHASE",
      `${boxDef.name} opened`,
      student.fullName
    );

    // Rarity roll per the published odds (Convex seeds Math.random in mutations)
    const roll = Math.random() * 100;
    let rarity: AvatarRarity = "common";
    if (roll < boxDef.odds.legendary) rarity = "legendary";
    else if (roll < boxDef.odds.legendary + boxDef.odds.uncommon) rarity = "uncommon";

    const pool = AVATAR_ITEMS.filter((i) => i.rarity === rarity && !i.isDefault);
    const item = pool[Math.floor(Math.random() * pool.length)];

    const owned = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const existing = owned.find((w) => w.wearableId === item.key);

    let outcome: "NEW" | "UPGRADE" | "SHARDS";
    let upgradeLevel = 0;
    let refund: number | undefined;

    if (!existing) {
      outcome = "NEW";
      await ctx.db.insert("studentWearables", {
        studentId: args.studentId,
        wearableId: item.key,
        acquiredAt: Date.now(),
        upgradeLevel: 0,
      });
      // Instant gratification: equip the fresh pull.
      const look = student.avatarLook ?? {};
      const slotKey = item.slot === "HAIRSTYLE" ? "hair" : item.slot === "TOP" ? "top" : "acc";
      await ctx.db.patch(args.studentId, {
        avatarLook: { ...look, [slotKey]: item.key },
      });
    } else if ((existing.upgradeLevel ?? 0) < MAX_UPGRADE_LEVEL) {
      outcome = "UPGRADE";
      upgradeLevel = (existing.upgradeLevel ?? 0) + 1;
      await ctx.db.patch(existing._id, { upgradeLevel });
    } else {
      outcome = "SHARDS";
      // Bargain Hunter perk lifts the shard refund above the base 40%.
      const refundPct = Math.max(SHARD_REFUND_PCT, volt.shardRefundPct / 100);
      refund = Math.round(boxDef.cost * refundPct);
      await applyPoints(
        ctx,
        args.studentId,
        refund,
        "SYSTEM",
        `${item.name} shards converted`,
        student.fullName
      );
    }

    await ctx.db.insert("lootBoxOpens", {
      studentId: args.studentId,
      box: args.box,
      cost: boxDef.cost,
      itemKey: item.key,
      rarity,
      outcome,
      refund,
      date,
      createdAt: Date.now(),
    });

    if (rarity === "legendary" && outcome === "NEW") {
      await logActivity(ctx, {
        type: "BADGE_EARNED",
        message: `${student.fullName} pulled the legendary ${item.name} from a crate!`,
        studentId: args.studentId,
        studentName: student.fullName,
        avatarUrl: student.avatarUrl,
      });
      await publishEvent(ctx, "rank_up", {
        type: "BADGE_EARNED",
        studentName: student.fullName,
        achievement: item.name,
        studentAvatar: student.avatarUrl,
        ts: Date.now(),
      });
    }

    const after = await ctx.db.get(args.studentId);
    return {
      outcome,
      item: { key: item.key, name: item.name, slot: item.slot, rarity: item.rarity },
      upgradeLevel,
      refund,
      balance: after?.points ?? 0,
      opensToday: todays.length + 1,
      capPerDay,
    };
  },
});

export const todayStatus = query({
  args: { studentId: v.id("students"), localDate: v.optional(v.string()) },
  handler: async (ctx, { studentId, localDate }) => {
    const date = resolveLocalDate(localDate);
    const student = await ctx.db.get(studentId);
    const capPerDay =
      LOOT_DAILY_CAP + voltEffects(student?.voltLoadout).crateCapPlus;
    const todays = await ctx.db
      .query("lootBoxOpens")
      .withIndex("by_student_date", (q) => q.eq("studentId", studentId).eq("date", date))
      .collect();
    return { opensToday: todays.length, capPerDay };
  },
});
