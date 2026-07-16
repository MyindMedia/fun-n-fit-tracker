import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { RANKS, DEMOTION_PENALTY_POINTS } from "../constants";

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

  const ranks = await getRankList(ctx);
  const basePoints = student.points + amount;

  const oldRank = ranks.find((r) => r.id === student.rankId) ?? ranks[0];
  const qualifiedInitial = ranks.filter((r) => basePoints >= r.threshold);
  const newRankInitial = qualifiedInitial[qualifiedInitial.length - 1] ?? ranks[0];

  const isDemotion = amount < 0 && newRankInitial.threshold < oldRank.threshold;
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
    createdAt: Date.now(),
  });

  if (isDemotion) {
    await ctx.db.insert("transactions", {
      studentId,
      amount: -DEMOTION_PENALTY_POINTS,
      sourceType: "SYSTEM",
      description: "Demotion penalty",
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
