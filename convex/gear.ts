import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { applyPoints, logActivity, publishEvent, resolveLocalDate } from "./helpers";
import {
  GEAR_DEFAULT_DURATION_MIN,
  GEAR_ITEMS,
  GearUnlock,
  gearItem,
  isConsumable,
} from "../gearCatalog";

// Gear: ranked power items with perks AND downsides. One equipped per kid;
// applyPoints reads students.gearEquipped and multiplies earning by source.
// Dual acquisition: grind the achievement (free) or buy at a premium price.
// Wave 3 consumables (usage DAILY/ONE_SHOT) never sit in the equipped slot:
// they activate for a timed window via gearActivations, one boost at a time.

async function ownedKeys(ctx: any, studentId: Id<"students">): Promise<Set<string>> {
  const rows = await ctx.db
    .query("studentGear")
    .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
    .collect();
  return new Set(rows.map((r: any) => r.gearKey));
}

// Progress toward one unlock criterion, computed from the real ledgers.
async function unlockProgress(ctx: any, studentId: Id<"students">, unlock: GearUnlock): Promise<number> {
  switch (unlock.type) {
    case "CHECKINS": {
      const rows = await ctx.db
        .query("checkIns")
        .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
        .collect();
      return rows.length;
    }
    case "LAPS": {
      const rows = await ctx.db
        .query("nfcScans")
        .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
        .collect();
      return rows.filter((r: any) => r.kind === "GAME").length;
    }
    case "MEDALS": {
      const rows = await ctx.db
        .query("medals")
        .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
        .collect();
      return rows.length;
    }
    case "CRATES": {
      const rows = await ctx.db
        .query("lootBoxOpens")
        .withIndex("by_student_date", (q: any) => q.eq("studentId", studentId))
        .collect();
      return rows.length;
    }
    case "VISITS": {
      const rows = await ctx.db
        .query("businessVisits")
        .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
        .collect();
      return rows.length;
    }
    case "LIFETIME_POINTS": {
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
        .collect();
      return rows.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + t.amount, 0);
    }
    default:
      return 0;
  }
}

// The whole shop for one kid: owned, equipped, and live achievement progress.
export const shop = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const owned = await ownedKeys(ctx, studentId);

    const items = [];
    for (const item of GEAR_ITEMS) {
      let progress: number | null = null;
      if (item.unlock && !owned.has(item.key)) {
        progress = await unlockProgress(ctx, studentId, item.unlock);
      }
      items.push({
        key: item.key,
        owned: owned.has(item.key),
        equipped: student.gearEquipped === item.key,
        progress,
      });
    }
    return { items, equipped: student.gearEquipped ?? null, points: student.points };
  },
});

export const equip = mutation({
  args: { studentId: v.id("students"), gearKey: v.union(v.string(), v.null()) },
  handler: async (ctx, { studentId, gearKey }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    if (gearKey !== null) {
      const item = gearItem(gearKey);
      if (!item) throw new Error("Unknown gear item");
      if (isConsumable(item)) {
        throw new Error("Boost items activate from your loadout, they can't be equipped");
      }
      const owned = await ownedKeys(ctx, studentId);
      if (!owned.has(gearKey)) throw new Error("You don't own that gear yet");
    }
    await ctx.db.patch(studentId, { gearEquipped: gearKey });
    return { equipped: gearKey };
  },
});

export const buy = mutation({
  args: { studentId: v.id("students"), gearKey: v.string() },
  handler: async (ctx, { studentId, gearKey }) => {
    const item = gearItem(gearKey);
    if (!item) throw new Error("Unknown gear item");
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const owned = await ownedKeys(ctx, studentId);
    if (owned.has(gearKey)) throw new Error("Already owned");
    if (student.points < item.price) {
      throw new Error(`${item.name} costs ${item.price} pts — you have ${student.points}`);
    }
    await applyPoints(ctx, studentId, -item.price, "STORE_PURCHASE", `${item.name} (gear)`, student.fullName);
    await ctx.db.insert("studentGear", {
      studentId,
      gearKey,
      acquiredVia: "BUY",
      acquiredAt: Date.now(),
    });
    // Fresh passive gear goes straight into the loadout; consumables wait in
    // the loadout panel until the kid fires them.
    if (!isConsumable(item)) {
      await ctx.db.patch(studentId, { gearEquipped: gearKey });
    }
    const after = await ctx.db.get(studentId);
    return { ok: true, balance: after?.points ?? 0 };
  },
});

// Claim an achievement unlock once the criterion is genuinely met.
export const claim = mutation({
  args: { studentId: v.id("students"), gearKey: v.string() },
  handler: async (ctx, { studentId, gearKey }) => {
    const item = gearItem(gearKey);
    if (!item?.unlock) throw new Error("That gear has no achievement path");
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const owned = await ownedKeys(ctx, studentId);
    if (owned.has(gearKey)) throw new Error("Already owned");
    const progress = await unlockProgress(ctx, studentId, item.unlock);
    if (progress < item.unlock.count) {
      throw new Error(`Not there yet — ${progress}/${item.unlock.count} (${item.unlock.label})`);
    }
    await ctx.db.insert("studentGear", {
      studentId,
      gearKey,
      acquiredVia: "ACHIEVEMENT",
      acquiredAt: Date.now(),
    });
    if (!isConsumable(item)) {
      await ctx.db.patch(studentId, { gearEquipped: gearKey });
    }
    await logActivity(ctx, {
      type: "BADGE_EARNED",
      message: `${student.fullName} earned the ${item.name} (${item.unlock.label})`,
      studentId,
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
    return { ok: true };
  },
});

// ── Consumable boosts (Wave 3) ─────────────────────────────────────────────

// Fire an owned consumable. One live boost per kid at a time; DAILY items are
// once per calendar day, ONE_SHOT items burn the studentGear row on use.
export const activate = mutation({
  args: {
    studentId: v.id("students"),
    gearKey: v.string(),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, { studentId, gearKey, localDate }) => {
    const item = gearItem(gearKey);
    if (!item) throw new Error("Unknown gear item");
    if (!isConsumable(item)) throw new Error("That gear is worn, not activated");
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const rows = await ctx.db
      .query("studentGear")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const ownedRow = rows.find((r) => r.gearKey === gearKey);
    if (!ownedRow) throw new Error("You don't own that boost yet");

    const now = Date.now();
    const live = await ctx.db
      .query("gearActivations")
      .withIndex("by_student", (q) => q.eq("studentId", studentId).gt("expiresAt", now))
      .first();
    if (live) throw new Error("One boost at a time. Wait for the timer to finish.");

    const date = resolveLocalDate(localDate);
    if (item.usage === "DAILY") {
      const today = await ctx.db
        .query("gearActivations")
        .withIndex("by_student_date", (q) => q.eq("studentId", studentId).eq("date", date))
        .collect();
      if (today.some((a) => a.gearKey === gearKey)) {
        throw new Error("Already used today. It recharges at midnight.");
      }
    }

    const expiresAt = now + (item.durationMin ?? GEAR_DEFAULT_DURATION_MIN) * 60_000;
    await ctx.db.insert("gearActivations", {
      studentId,
      gearKey,
      kind: item.usage as "DAILY" | "ONE_SHOT",
      date,
      activatedAt: now,
      expiresAt,
    });

    if (item.usage === "ONE_SHOT") {
      // Single use: the item burns on activation. Consumables never occupy
      // the equipped passive slot, so gearEquipped needs no cleanup here.
      await ctx.db.delete(ownedRow._id);
    }

    await logActivity(ctx, {
      type: "GEAR",
      message: `${student.fullName} activated ${item.name}`,
      studentId,
      studentName: student.fullName,
      avatarUrl: student.avatarUrl,
    });
    return { ok: true, expiresAt };
  },
});

// The kid's boost bench: owned consumables with per-item state plus whatever
// boost is live right now (a burning ONE_SHOT no longer has a gear row, so
// the active entry is reported separately).
export const loadout = query({
  args: { studentId: v.id("students"), localDate: v.optional(v.string()) },
  handler: async (ctx, { studentId, localDate }) => {
    const now = Date.now();
    const date = resolveLocalDate(localDate);

    const rows = await ctx.db
      .query("studentGear")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const live = await ctx.db
      .query("gearActivations")
      .withIndex("by_student", (q) => q.eq("studentId", studentId).gt("expiresAt", now))
      .order("desc")
      .first();
    const today = await ctx.db
      .query("gearActivations")
      .withIndex("by_student_date", (q) => q.eq("studentId", studentId).eq("date", date))
      .collect();
    const usedToday = new Set(
      today.filter((a) => a.kind === "DAILY").map((a) => a.gearKey)
    );

    const seen = new Set<string>();
    const items = [];
    for (const row of rows) {
      const item = gearItem(row.gearKey);
      if (!item || !isConsumable(item) || seen.has(row.gearKey)) continue;
      seen.add(row.gearKey);
      const isActive = live?.gearKey === row.gearKey;
      items.push({
        key: row.gearKey,
        state: isActive ? "ACTIVE" : usedToday.has(row.gearKey) ? "USED_TODAY" : "READY",
        oneShot: item.usage === "ONE_SHOT",
        expiresAt: isActive ? live!.expiresAt : null,
      });
    }

    return {
      active: live
        ? { gearKey: live.gearKey, kind: live.kind, expiresAt: live.expiresAt }
        : null,
      items,
    };
  },
});
