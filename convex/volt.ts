import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logActivity } from "./helpers";
import {
  VOLT_PERKS,
  VOLT_WILDCARDS,
  VoltLoadout,
  voltActiveSpecialty,
  voltEffects,
  voltLevelForXp,
  voltNextLevelXp,
  voltPerk,
  voltWildcard,
  voltRule,
  XP_SOURCES,
} from "../voltCatalog";

// Volt System backend (VOLT_SPEC.md): COD-style perk loadout, XP levels,
// and the player stats area. Perks are free to equip once the kid's Volt
// Level unlocks them; every effect is applied server-side in the economy
// paths (helpers/gear/lootBoxes/trades).

const emptyLoadout = (): VoltLoadout => ({
  perk1: null,
  perk2: null,
  perk3: null,
  flex: null,
  wildcard: null,
});

// Full profile payload for the stats area + loadout screen.
export const profile = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const xp = student.totalXp ?? 0;
    const level = voltLevelForXp(xp);
    const next = voltNextLevelXp(xp);
    const loadout = (student.voltLoadout ?? emptyLoadout()) as VoltLoadout;

    // Stats grid (COD combat-record style) from the real ledgers.
    const [checkIns, medals, crates, visits, tradesIn, tradesOut, gameTaps, txns] =
      await Promise.all([
        ctx.db.query("checkIns").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect(),
        ctx.db.query("medals").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect(),
        ctx.db.query("lootBoxOpens").withIndex("by_student_date", (q) => q.eq("studentId", studentId)).collect(),
        ctx.db.query("businessVisits").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect(),
        ctx.db.query("trades").withIndex("by_to", (q) => q.eq("toStudentId", studentId).eq("status", "ACCEPTED")).collect(),
        ctx.db.query("trades").withIndex("by_from", (q) => q.eq("fromStudentId", studentId).eq("status", "ACCEPTED")).collect(),
        ctx.db.query("nfcScans").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect(),
        ctx.db.query("transactions").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect(),
      ]);

    const lifetimePoints = txns
      .filter((t) => t.amount > 0 && XP_SOURCES.includes(t.sourceType))
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      xp,
      level,
      nextLevel: next, // null at max level
      loadout,
      activeSpecialty: voltActiveSpecialty(loadout),
      effects: voltEffects(loadout),
      unlockedPerks: VOLT_PERKS.filter((p) => p.unlockLevel <= level).map((p) => p.key),
      unlockedWildcards: VOLT_WILDCARDS.filter((w) => w.unlockLevel <= level).map((w) => w.key),
      stats: {
        currentPoints: student.points,
        lifetimePoints,
        checkIns: checkIns.length,
        medals: medals.length,
        cratesOpened: crates.length,
        partnerVisits: visits.length,
        tradesDone: tradesIn.length + tradesOut.length,
        bandTaps: gameTaps.filter((s) => s.kind === "GAME").length,
      },
    };
  },
});

// Equip (or clear with key=null) one slot of the loadout.
export const equip = mutation({
  args: {
    studentId: v.id("students"),
    slot: v.union(
      v.literal("perk1"),
      v.literal("perk2"),
      v.literal("perk3"),
      v.literal("flex"),
      v.literal("wildcard")
    ),
    key: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { studentId, slot, key }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const level = voltLevelForXp(student.totalXp ?? 0);
    const loadout = { ...emptyLoadout(), ...(student.voltLoadout ?? {}) } as VoltLoadout;

    if (key !== null) {
      if (slot === "wildcard") {
        const wc = voltWildcard(key);
        if (!wc) throw new Error("Unknown wildcard");
        if (wc.unlockLevel > level) throw new Error(`Unlocks at Volt Level ${wc.unlockLevel}`);
      } else {
        const perk = voltPerk(key);
        if (!perk) throw new Error("Unknown perk");
        if (perk.unlockLevel > level) throw new Error(`Unlocks at Volt Level ${perk.unlockLevel}`);
        if (slot === "flex") {
          if (!voltRule(loadout, "PERK_GREED")) {
            throw new Error("The flex slot needs the Perk Greed wildcard");
          }
          const equipped = [loadout.perk1, loadout.perk2, loadout.perk3];
          if (equipped.includes(key)) throw new Error("That perk is already equipped");
        } else {
          const rowNum = Number(slot.slice(-1)) as 1 | 2 | 3;
          if (perk.slot !== rowNum) throw new Error("That perk belongs to a different row");
          if (loadout.flex === key) throw new Error("That perk is already in your flex slot");
        }
      }
    }

    (loadout as Record<string, string | null | undefined>)[slot] = key;
    // Swapping away from Perk Greed clears the flex perk it enabled.
    if (slot === "wildcard" && !voltRule(loadout, "PERK_GREED")) {
      loadout.flex = null;
    }

    await ctx.db.patch(studentId, { voltLoadout: loadout });

    if (key !== null) {
      const name =
        slot === "wildcard" ? voltWildcard(key)?.name : voltPerk(key)?.name;
      await logActivity(ctx, {
        type: "POINTS",
        message: `equipped ${name} (Volt ${slot === "wildcard" ? "wildcard" : "perk"})`,
        studentId,
        studentName: student.fullName,
      });
    }
    return { ok: true, loadout, activeSpecialty: voltActiveSpecialty(loadout) };
  },
});

// One-time backfill: every kid's totalXp becomes at least their lifetime
// positive point earnings, so kids start the Volt ladder where their history
// puts them ("a combo of XP and points"). Idempotent: uses max(), never lowers.
export const backfillXp = internalMutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    let updated = 0;
    for (const s of students) {
      const txns = await ctx.db
        .query("transactions")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .collect();
      const lifetime = txns
        .filter((t) => t.amount > 0 && XP_SOURCES.includes(t.sourceType))
        .reduce((sum, t) => sum + t.amount, 0);
      const current = s.totalXp ?? 0;
      if (lifetime > current) {
        await ctx.db.patch(s._id, { totalXp: lifetime });
        await ctx.db.insert("xpTransactions", {
          studentId: s._id,
          amount: lifetime - current,
          sourceType: "SYSTEM",
          description: "Volt System backfill from lifetime earnings",
          createdAt: Date.now(),
        });
        updated++;
      }
    }
    return { students: students.length, updated };
  },
});
