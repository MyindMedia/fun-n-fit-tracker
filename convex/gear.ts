import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { applyPoints, logActivity, publishEvent } from "./helpers";
import { GEAR_ITEMS, GearUnlock, gearItem } from "../gearCatalog";

// Gear: ranked power items with perks AND downsides. One equipped per kid;
// applyPoints reads students.gearEquipped and multiplies earning by source.
// Dual acquisition: grind the achievement (free) or buy at a premium price.

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
      if (!gearItem(gearKey)) throw new Error("Unknown gear item");
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
    // Fresh gear goes straight into the loadout.
    await ctx.db.patch(studentId, { gearEquipped: gearKey });
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
    await ctx.db.patch(studentId, { gearEquipped: gearKey });
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
