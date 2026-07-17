import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { queueCelebration } from "./celebrations";
import { RANKS, DEMOTION_PENALTY_POINTS } from "../constants";
import { voltEffects, voltLevelForXp, XP_SOURCES, XP_FACTOR_MAX } from "../voltCatalog";
import { gearItem } from "../gearCatalog";
import { gearDelta, GEAR_FACTOR_MAX, GEAR_FACTOR_MIN, GearSource } from "../gearCatalog";

export interface RankInfo {
  id: string;
  name: string;
  threshold: number;
  icon: string;
  color: string;
  description?: string;
  xpReward?: number;
  pointsRequired?: number;
  criteriaTasks?: string[];
  type?: "RANK" | "TROPHY";
}

// Ranks sorted by threshold; falls back to the bundled defaults when the table is empty
export async function getRankList(ctx: QueryCtx): Promise<RankInfo[]> {
  const docs = await ctx.db.query("ranks").withIndex("by_threshold").collect();
  if (docs.length === 0) {
    return RANKS.map((r) => ({ ...r }));
  }
  return docs.map((r) => ({
    id: r.key,
    name: r.name,
    threshold: r.threshold,
    icon: r.icon,
    color: r.color,
    description: r.description,
    xpReward: r.xpReward,
    pointsRequired: r.pointsRequired,
    criteriaTasks: r.criteriaTasks,
    type: r.type,
  }));
}

export async function logActivity(
  ctx: MutationCtx,
  args: {
    type: string;
    message: string;
    adminName?: string | null;
    studentId?: string | null;
    studentName?: string | null;
    amount?: number | null;
    avatarUrl?: string | null;
    houseId?: "UNITY" | "SAGE" | "SPARK" | "VALOR" | null;
  }
) {
  await ctx.db.insert("notifications", {
    type: args.type,
    message: args.message,
    adminName: args.adminName ?? undefined,
    studentId: args.studentId ?? undefined,
    studentName: args.studentName ?? undefined,
    amount: args.amount ?? undefined,
    avatarUrl: args.avatarUrl ?? undefined,
    houseId: args.houseId ?? undefined,
    timestamp: Date.now(),
  });
}

export async function publishEvent(
  ctx: MutationCtx,
  kind: string,
  payload: unknown,
  source?: string
) {
  await ctx.db.insert("appEvents", { kind, payload, source, ts: Date.now() });
  // Opportunistic cleanup: drop a few events older than an hour
  const cutoff = Date.now() - 60 * 60 * 1000;
  const stale = await ctx.db
    .query("appEvents")
    .withIndex("by_ts", (q) => q.lt("ts", cutoff))
    .take(10);
  for (const doc of stale) {
    await ctx.db.delete(doc._id);
  }
}

export interface AwardResult {
  studentId: Id<"students">;
  fullName: string;
  avatarUrl?: string;
  amount: number;
  finalPoints: number;
  didRankUp: boolean;
  newRank: RankInfo;
}

// Transactional port of SupabaseService.addPoints: points + rank promotion/demotion +
// ledger + activity feed + cross-client broadcast events, all in one mutation.
export async function applyPoints(
  ctx: MutationCtx,
  studentId: Id<"students">,
  amount: number,
  sourceType: string,
  description: string,
  adminName: string,
  clientId?: string
): Promise<AwardResult> {
  const student = await ctx.db.get(studentId);
  if (!student) throw new Error("Student not found");

  // Volt System (voltCatalog.ts): the kid's merged perk/wildcard bonuses.
  const volt = voltEffects(student.voltLoadout);

  // Live consumable activations (points boosts AND XP tokens). Usually one;
  // the Double Down wildcard allows two, so read them all.
  let liveActivations: Array<Doc<"gearActivations">> = [];
  if (amount > 0) {
    const nowTs = Date.now();
    liveActivations = await ctx.db
      .query("gearActivations")
      .withIndex("by_student", (q) =>
        q.eq("studentId", studentId).gt("expiresAt", nowTs)
      )
      .collect();
  }

  // Global point multiplier (2x Fridays etc.) — set from the admin dashboard.
  // Only boosts positive earnings; spends, refunds, system credits, and
  // jackpot gifts stay 1:1.
  if (
    amount > 0 &&
    sourceType !== "REDEMPTION" &&
    sourceType !== "STORE_PURCHASE" &&
    sourceType !== "SYSTEM" &&
    sourceType !== "JACKPOT"
  ) {
    const multRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "point_multiplier"))
      .unique();
    const mult = multRow ? parseFloat(multRow.value) : 1;
    if (Number.isFinite(mult) && mult > 1) {
      amount = Math.round(amount * mult);
      description = `${description} (${mult}x)`;
    }

    // Gear multipliers (gearCatalog.ts): the equipped passive piece plus, if
    // one is running, a live consumable boost (gearActivations). The two
    // factors are COMBINED first, clamped once to [0.5, 2.0], then applied in
    // a single rounding pass, so stacking can never push past 2x overall.
    // Ledger line carries both parts: "(gear +15%) (boost +40%)".
    const gearSource: GearSource | null =
      sourceType === "MANUAL" ? "game"
      : sourceType === "CHECKIN" ? "checkin"
      : sourceType === "PARTNER_VISIT" || sourceType === "SPECIAL_TASK" ? "earn"
      : null;
    if (gearSource) {
      let combined = 1;
      let suffix = "";
      if (student.gearEquipped) {
        const passive = 1 + gearDelta(student.gearEquipped, gearSource);
        if (passive !== 1) {
          combined *= passive;
          const pct = Math.round((passive - 1) * 100);
          suffix += ` (gear ${pct > 0 ? "+" : ""}${pct}%)`;
        }
      }
      for (const activation of liveActivations) {
        const boost = 1 + gearDelta(activation.gearKey, gearSource);
        if (boost !== 1) {
          combined *= boost;
          const pct = Math.round((boost - 1) * 100);
          suffix += ` (boost ${pct > 0 ? "+" : ""}${pct}%)`;
        }
      }
      // Volt perks: percent bonuses join the same combined factor + clamp.
      const perkPct = gearSource === "game" ? volt.gamePct : gearSource === "earn" ? volt.earnPct : 0;
      if (perkPct > 0) {
        combined *= 1 + perkPct / 100;
        suffix += ` (perk +${perkPct}%)`;
      }
      combined = Math.min(GEAR_FACTOR_MAX, Math.max(GEAR_FACTOR_MIN, combined));
      if (combined !== 1) {
        amount = Math.max(1, Math.round(amount * combined));
      }
      // Flat check-in bonus from Volt perks lands AFTER multipliers (never amplified).
      if (gearSource === "checkin" && volt.checkinFlat > 0) {
        amount += volt.checkinFlat;
        suffix += ` (perk +${volt.checkinFlat})`;
      }
      if (suffix) {
        description = `${description}${suffix}`;
      }
    }
  }

  const ranks = await getRankList(ctx);
  const basePoints = student.points + amount;

  const oldRank = ranks.find((r) => r.id === student.rankId) ?? ranks[0];
  const qualifiedInitial = ranks.filter((r) => basePoints >= r.threshold);
  const newRankInitial = qualifiedInitial[qualifiedInitial.length - 1] ?? ranks[0];

  // Iron Will perk (Volt System): rank can still drop, but the penalty
  // points never hit — big shop spends stop stinging twice.
  const isDemotion =
    amount < 0 &&
    newRankInitial.threshold < oldRank.threshold &&
    !volt.demotionShield;
  const finalPoints = isDemotion
    ? Math.max(0, basePoints - DEMOTION_PENALTY_POINTS)
    : basePoints;
  const qualifiedFinal = ranks.filter((r) => finalPoints >= r.threshold);
  const newRankFinal = qualifiedFinal[qualifiedFinal.length - 1] ?? ranks[0];

  const didRankUp =
    newRankFinal.id !== student.rankId && newRankFinal.threshold > oldRank.threshold;

  if (newRankFinal.id !== student.rankId) {
    if (newRankFinal.threshold > oldRank.threshold) {
      await logActivity(ctx, {
        type: "RANK_UP",
        message: `Promoted to ${newRankFinal.name}!`,
        adminName,
        studentId,
        studentName: student.fullName,
      });
    } else if (newRankFinal.threshold < oldRank.threshold) {
      const penaltyNote = isDemotion ? ` (-${DEMOTION_PENALTY_POINTS} pts penalty)` : "";
      await logActivity(ctx, {
        type: "RANK_DOWN",
        message: `Demoted to ${newRankFinal.name}${penaltyNote}`,
        adminName,
        studentId,
        studentName: student.fullName,
      });
    }
  }

  await ctx.db.patch(studentId, { points: finalPoints, rankId: newRankFinal.id });

  await ctx.db.insert("transactions", {
    studentId,
    amount,
    sourceType,
    description,
    adminName,
    createdAt: Date.now(),
  });

  if (isDemotion) {
    await ctx.db.insert("transactions", {
      studentId,
      amount: -DEMOTION_PENALTY_POINTS,
      sourceType: "SYSTEM",
      description: "Demotion penalty",
      adminName,
      createdAt: Date.now(),
    });
    await logActivity(ctx, {
      type: "POINTS",
      message: `-${DEMOTION_PENALTY_POINTS} pts: Demotion penalty`,
      adminName,
      studentId,
      studentName: student.fullName,
      amount: -DEMOTION_PENALTY_POINTS,
    });
  }

  if (amount > 0) {
    await logActivity(ctx, {
      type: "POINTS",
      message: `+${amount} pts: ${description}`,
      adminName,
      studentId,
      studentName: student.fullName,
      amount,
    });
    await publishEvent(
      ctx,
      "points_change",
      {
        studentId,
        studentName: student.fullName,
        amount,
        message: `+${amount} pts: ${description}`,
        ts: Date.now(),
      },
      clientId
    );
  } else if (amount < 0) {
    const amt = Math.abs(amount);
    await logActivity(ctx, {
      type: "POINTS",
      message: `-${amt} pts: ${description}`,
      adminName,
      studentId,
      studentName: student.fullName,
      amount: -amt,
    });
    await publishEvent(
      ctx,
      "points_change",
      {
        studentId,
        studentName: student.fullName,
        amount: -amt,
        message: `-${amt} pts: ${description}`,
        ts: Date.now(),
      },
      clientId
    );
  }

  if (didRankUp) {
    await publishEvent(
      ctx,
      "rank_up",
      {
        type: "RANK_UP",
        studentName: student.fullName,
        achievement: newRankFinal.name,
        studentAvatar: student.avatarUrl,
        rankIcon: newRankFinal.icon,
        ts: Date.now(),
      },
      clientId
    );
  }

  // ── Volt XP mirror ─────────────────────────────────────────────────────────
  // Positive earnings grant XP alongside points. XP never decreases; spends,
  // refunds, and system credits never grant it. Multipliers: Volt perk xpPct,
  // live XP tokens (gearCatalog xpBoost), and the admin xp_multiplier event
  // setting — capped at XP_FACTOR_MAX overall.
  if (amount > 0 && XP_SOURCES.includes(sourceType)) {
    let xpFactor = 1 + volt.xpPct / 100;
    for (const activation of liveActivations) {
      xpFactor += gearItem(activation.gearKey)?.xpBoost ?? 0;
    }
    const xpMultRow = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "xp_multiplier"))
      .unique();
    const xpMult = xpMultRow ? parseFloat(xpMultRow.value) : 1;
    if (Number.isFinite(xpMult) && xpMult > 1) {
      xpFactor += xpMult - 1;
    }
    xpFactor = Math.min(XP_FACTOR_MAX, Math.max(1, xpFactor));

    const xpGain = Math.max(1, Math.round(amount * xpFactor));
    const oldXp = student.totalXp ?? 0;
    const newXp = oldXp + xpGain;
    await ctx.db.insert("xpTransactions", {
      studentId,
      amount: xpGain,
      sourceType,
      description: xpFactor > 1 ? `${description} (${xpFactor.toFixed(2)}x XP)` : description,
      createdAt: Date.now(),
    });
    await ctx.db.patch(studentId, { totalXp: newXp });

    const oldLevel = voltLevelForXp(oldXp);
    const newLevel = voltLevelForXp(newXp);
    if (newLevel > oldLevel) {
      await logActivity(ctx, {
        type: "RANK_UP",
        message: `hit Volt Level ${newLevel}!`,
        studentId,
        studentName: student.fullName,
      });
      await publishEvent(
        ctx,
        "rank_up",
        {
          type: "BADGE_EARNED",
          studentName: student.fullName,
          achievement: `VOLT LEVEL ${newLevel}`,
          studentAvatar: student.avatarUrl,
          message: `${student.fullName} hit Volt Level ${newLevel}!`,
          ts: Date.now(),
        },
        clientId
      );
      // Queue the congrats pop-up for the kid/family portals and ping ONLY
      // this kid's linked families (not every subscribed device).
      await queueCelebration(ctx, {
        studentId,
        kind: "LEVEL_UP",
        title: `VOLT LEVEL ${newLevel}`,
        message: `${student.fullName} hit Volt Level ${newLevel}!`,
      });
      const links = await ctx.db
        .query("parentStudentLinks")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .collect();
      if (links.length > 0) {
        await ctx.scheduler.runAfter(0, internal.pushNode.deliver, {
          title: "Volt Level Up!",
          body: `${student.fullName} hit Volt Level ${newLevel}! Open the app for the celebration.`,
          url: "/#/parent-dashboard",
          tag: "fnf-levelup",
          parentIds: links.map((l) => l.parentId as string),
        });
      }
    }
  }

  return {
    studentId,
    fullName: student.fullName,
    avatarUrl: student.avatarUrl,
    amount,
    finalPoints,
    didRankUp,
    newRank: newRankFinal,
  };
}

export function studentDefaults(fullName: string) {
  return {
    points: 0,
    hasWearable: false,
    isPresent: true,
    rankId: "r_noob",
    badges: [] as string[],
    inventory: [] as string[],
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
      fullName || "student"
    )}`,
    createdAt: Date.now(),
  };
}

export type StudentDoc = Doc<"students">;

// ── Game center shared helpers ───────────────────────────────────────────────

// Resolve a parent from a portal session token; null when missing/expired.
export async function parentFromToken(
  ctx: QueryCtx,
  token: string
): Promise<Doc<"parents"> | null> {
  const session = await ctx.db
    .query("parentSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.parentId);
}

export async function requireParent(ctx: QueryCtx, token: string): Promise<Doc<"parents">> {
  const parent = await parentFromToken(ctx, token);
  if (!parent) throw new Error("Session expired — please sign in again");
  return parent;
}

// Guards parent-initiated actions on a student they aren't linked to.
export async function requireParentLink(
  ctx: QueryCtx,
  parentId: Id<"parents">,
  studentId: Id<"students">
): Promise<void> {
  const link = await ctx.db
    .query("parentStudentLinks")
    .withIndex("by_parent_student", (q) =>
      q.eq("parentId", parentId).eq("studentId", studentId)
    )
    .unique();
  if (!link) throw new Error("That athlete is not linked to your account");
}

export function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Falls back to the server's UTC date when the client didn't send its local one.
export function resolveLocalDate(localDate?: string): string {
  if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) return localDate;
  return new Date().toISOString().slice(0, 10);
}
