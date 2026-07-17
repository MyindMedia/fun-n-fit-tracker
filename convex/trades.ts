import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { logActivity } from "./helpers";
import { avatarItem, DEFAULT_LOOK } from "../avatarCatalog";
import { voltEffects } from "../voltCatalog";
import { gearItem } from "../gearCatalog";
import { BADGES } from "../constants";

// Player-to-player trading: badges (students.badges), avatar items
// (studentWearables), and gear (studentGear). Both sides consent: an offer
// sits PENDING until the other kid accepts or declines. Gear trades only when
// the catalog marks it tradable (passive rank C/B with no unlock): earned
// achievements and consumable boosts stay with their owner by design.

const KINDS = ["BADGE", "ITEM", "GEAR"] as const;
type Kind = (typeof KINDS)[number];

const badgeExists = (key: string) => BADGES.some((b) => b.id === key);

async function ownsThing(ctx: any, studentId: Id<"students">, kind: Kind, key: string): Promise<boolean> {
  if (kind === "BADGE") {
    const s = await ctx.db.get(studentId);
    return !!s?.badges?.includes(key);
  }
  if (kind === "GEAR") {
    const rows = await ctx.db
      .query("studentGear")
      .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
      .collect();
    return rows.some((r: any) => r.gearKey === key);
  }
  const rows = await ctx.db
    .query("studentWearables")
    .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
    .collect();
  return rows.some((r: any) => r.wearableId === key);
}

function assertKindKey(kind: string, key: string) {
  if (!KINDS.includes(kind as Kind)) throw new Error("Unknown trade kind");
  if (kind === "BADGE" && !badgeExists(key)) throw new Error("Unknown badge");
  if (kind === "ITEM") {
    const item = avatarItem(key);
    if (!item) throw new Error("Unknown item");
    if (item.isDefault) throw new Error("Starter items can't be traded");
  }
  if (kind === "GEAR") {
    const item = gearItem(key);
    if (!item) throw new Error("Unknown gear");
    if (item.tradable !== true) {
      throw new Error("That gear can't be traded. Earned gear stays earned.");
    }
  }
}

// Move one thing from `from` to `to` (ownership + equipped-look cleanup).
async function transferThing(
  ctx: any,
  from: Doc<"students">,
  to: Doc<"students">,
  kind: Kind,
  key: string
) {
  if (kind === "BADGE") {
    await ctx.db.patch(from._id, { badges: (from.badges ?? []).filter((b: string) => b !== key) });
    const toBadges = to.badges ?? [];
    if (!toBadges.includes(key)) await ctx.db.patch(to._id, { badges: [...toBadges, key] });
    return;
  }
  if (kind === "GEAR") {
    // Move the studentGear row (how it was acquired travels with it), and if
    // the giver was wearing it, empty their equipped slot.
    const fromGear = await ctx.db
      .query("studentGear")
      .withIndex("by_student", (q: any) => q.eq("studentId", from._id))
      .collect();
    const row = fromGear.find((r: any) => r.gearKey === key);
    if (row) {
      await ctx.db.delete(row._id);
      await ctx.db.insert("studentGear", {
        studentId: to._id,
        gearKey: key,
        acquiredVia: row.acquiredVia,
        acquiredAt: Date.now(),
      });
    }
    if (from.gearEquipped === key) {
      await ctx.db.patch(from._id, { gearEquipped: null });
    }
    return;
  }
  // ITEM: move the studentWearables row (upgrade tier travels with it)
  const fromRows = await ctx.db
    .query("studentWearables")
    .withIndex("by_student", (q: any) => q.eq("studentId", from._id))
    .collect();
  const row = fromRows.find((r: any) => r.wearableId === key);
  if (row) {
    await ctx.db.delete(row._id);
    await ctx.db.insert("studentWearables", {
      studentId: to._id,
      wearableId: key,
      acquiredAt: Date.now(),
      upgradeLevel: row.upgradeLevel ?? 0,
    });
  }
  // If the giver was wearing it, fall back to a starter piece.
  const look = from.avatarLook ?? {};
  const item = avatarItem(key)!;
  const slotKey = item.slot === "HAIRSTYLE" ? "hair" : item.slot === "TOP" ? "top" : "acc";
  if ((look as any)[slotKey] === key) {
    const fallback = slotKey === "hair" ? DEFAULT_LOOK.hair : slotKey === "top" ? DEFAULT_LOOK.top : null;
    await ctx.db.patch(from._id, { avatarLook: { ...look, [slotKey]: fallback } });
  }
}

// What a kid can put on the table (used by the trade builder for both sides).
export const tradable = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const rows = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const gearRows = await ctx.db
      .query("studentGear")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const gearKeys = new Set<string>();
    for (const r of gearRows) {
      if (gearItem(r.gearKey)?.tradable === true) gearKeys.add(r.gearKey);
    }
    return {
      badges: (student.badges ?? []).filter(badgeExists),
      items: rows
        .filter((r) => {
          const item = avatarItem(r.wearableId);
          return item && !item.isDefault;
        })
        .map((r) => ({ key: r.wearableId, upgradeLevel: r.upgradeLevel ?? 0 })),
      gear: [...gearKeys].map((key) => ({ key })),
    };
  },
});

export const propose = mutation({
  args: {
    fromStudentId: v.id("students"),
    toStudentId: v.id("students"),
    giveKind: v.string(),
    giveKey: v.string(),
    wantKind: v.string(),
    wantKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.fromStudentId === args.toStudentId) throw new Error("Can't trade with yourself");
    assertKindKey(args.giveKind, args.giveKey);
    assertKindKey(args.wantKind, args.wantKey);
    if (args.giveKind === args.wantKind && args.giveKey === args.wantKey) {
      throw new Error("That's the same thing on both sides");
    }
    if (!(await ownsThing(ctx, args.fromStudentId, args.giveKind as Kind, args.giveKey))) {
      throw new Error("You don't own that anymore");
    }
    if (!(await ownsThing(ctx, args.toStudentId, args.wantKind as Kind, args.wantKey))) {
      throw new Error("They don't own that anymore");
    }
    const dupes = await ctx.db
      .query("trades")
      .withIndex("by_from", (q) => q.eq("fromStudentId", args.fromStudentId).eq("status", "PENDING"))
      .collect();
    if (dupes.some((t) => t.toStudentId === args.toStudentId && t.giveKey === args.giveKey && t.wantKey === args.wantKey)) {
      throw new Error("You already sent that exact offer");
    }
    // Deal Maker perk (Volt System) raises the open-offer cap above 5.
    const sender = await ctx.db.get(args.fromStudentId);
    const offerCap = 5 + voltEffects(sender?.voltLoadout).tradeSlotsPlus;
    if (dupes.length >= offerCap) throw new Error("Too many open offers — cancel one first");

    await ctx.db.insert("trades", {
      ...args,
      status: "PENDING",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const respond = mutation({
  args: { tradeId: v.id("trades"), accept: v.boolean() },
  handler: async (ctx, { tradeId, accept }) => {
    const trade = await ctx.db.get(tradeId);
    if (!trade || trade.status !== "PENDING") throw new Error("That offer is no longer open");

    if (!accept) {
      await ctx.db.patch(tradeId, { status: "DECLINED", resolvedAt: Date.now() });
      return { ok: true, status: "DECLINED" };
    }

    // Re-validate both sides at accept time; anything moved → offer dies.
    const stillGive = await ownsThing(ctx, trade.fromStudentId, trade.giveKind as Kind, trade.giveKey);
    const stillWant = await ownsThing(ctx, trade.toStudentId, trade.wantKind as Kind, trade.wantKey);
    if (!stillGive || !stillWant) {
      await ctx.db.patch(tradeId, { status: "CANCELLED", resolvedAt: Date.now() });
      throw new Error("The trade fell through — one side no longer owns their piece");
    }

    const from = (await ctx.db.get(trade.fromStudentId))!;
    const to = (await ctx.db.get(trade.toStudentId))!;
    await transferThing(ctx, from, to, trade.giveKind as Kind, trade.giveKey);
    // Reload docs — badges/looks may have just changed.
    const from2 = (await ctx.db.get(trade.fromStudentId))!;
    const to2 = (await ctx.db.get(trade.toStudentId))!;
    await transferThing(ctx, to2, from2, trade.wantKind as Kind, trade.wantKey);

    await ctx.db.patch(tradeId, { status: "ACCEPTED", resolvedAt: Date.now() });
    await logActivity(ctx, {
      type: "TRADE",
      message: `${from.fullName} and ${to.fullName} made a trade`,
      studentId: trade.fromStudentId,
      studentName: from.fullName,
    });
    return { ok: true, status: "ACCEPTED" };
  },
});

export const cancel = mutation({
  args: { tradeId: v.id("trades"), byStudentId: v.id("students") },
  handler: async (ctx, { tradeId, byStudentId }) => {
    const trade = await ctx.db.get(tradeId);
    if (!trade || trade.status !== "PENDING") throw new Error("That offer is no longer open");
    if (trade.fromStudentId !== byStudentId) throw new Error("Only the sender can cancel");
    await ctx.db.patch(tradeId, { status: "CANCELLED", resolvedAt: Date.now() });
    return { ok: true };
  },
});

// Open offers for a kid's trade inbox (incoming + outgoing, names resolved).
export const listFor = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const incoming = await ctx.db
      .query("trades")
      .withIndex("by_to", (q) => q.eq("toStudentId", studentId).eq("status", "PENDING"))
      .collect();
    const outgoing = await ctx.db
      .query("trades")
      .withIndex("by_from", (q) => q.eq("fromStudentId", studentId).eq("status", "PENDING"))
      .collect();
    const withNames = async (rows: typeof incoming) => {
      const out = [];
      for (const t of rows) {
        const from = await ctx.db.get(t.fromStudentId);
        const to = await ctx.db.get(t.toStudentId);
        out.push({
          _id: t._id,
          fromName: from?.fullName ?? "(gone)",
          toName: to?.fullName ?? "(gone)",
          giveKind: t.giveKind,
          giveKey: t.giveKey,
          wantKind: t.wantKind,
          wantKey: t.wantKey,
          createdAt: t.createdAt,
        });
      }
      return out;
    };
    return { incoming: await withNames(incoming), outgoing: await withNames(outgoing) };
  },
});
