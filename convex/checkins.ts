import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  applyPoints,
  logActivity,
  publishEvent,
  randomToken,
  reevaluateRank,
  requireParent,
  requireParentLink,
  resolveLocalDate,
} from "./helpers";
import { Id } from "./_generated/dataModel";

export const CHECKIN_BONUS_POINTS = 10;
const FRONT_DESK_TOKEN_TTL_MS = 90 * 1000;
const NFC_SECRET_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000; // long-lived; rotatable from admin

// ── Tokens ───────────────────────────────────────────────────────────────────

// Called by the admin Check-In Board on an interval; each call mints a fresh
// short-lived QR token and prunes expired ones.
export const issueToken = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("checkinTokens")
      .withIndex("by_kind", (q) => q.eq("kind", "FRONT_DESK"))
      .collect();
    for (const t of stale) {
      if (t.expiresAt < now) await ctx.db.delete(t._id);
    }
    const token = randomToken(16);
    const expiresAt = now + FRONT_DESK_TOKEN_TTL_MS;
    await ctx.db.insert("checkinTokens", {
      token,
      kind: "FRONT_DESK",
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt };
  },
});

export const nfcSecret = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("checkinTokens")
      .withIndex("by_kind", (q) => q.eq("kind", "NFC_KIOSK"))
      .collect();
    const active = rows.find((r) => r.expiresAt > Date.now());
    return active ? { token: active.token, createdAt: active.createdAt } : null;
  },
});

// Replaces any existing NFC kiosk secret (invalidates old physical tags).
export const rotateNfcSecret = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("checkinTokens")
      .withIndex("by_kind", (q) => q.eq("kind", "NFC_KIOSK"))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    const now = Date.now();
    const token = randomToken(16);
    await ctx.db.insert("checkinTokens", {
      token,
      kind: "NFC_KIOSK",
      expiresAt: now + NFC_SECRET_TTL_MS,
      createdAt: now,
    });
    return { token };
  },
});

// ── Check-in / check-out ─────────────────────────────────────────────────────

export async function checkInStudent(
  ctx: any,
  studentId: Id<"students">,
  date: string,
  method: "QR" | "NFC" | "MANUAL",
  actorName: string,
  byParentId?: Id<"parents">,
  byAdminName?: string
) {
  const student = await ctx.db.get(studentId);
  if (!student) throw new Error("Student not found");

  const existing = await ctx.db
    .query("checkIns")
    .withIndex("by_student_date", (q: any) => q.eq("studentId", studentId).eq("date", date))
    .unique();
  if (existing && !existing.checkedOutAt) {
    // "Already checked in" is only true if they're actually marked present.
    // Daily resets and legacy presence toggles flip the flag without closing
    // the ledger row — a scan must self-heal that desync, not report ALREADY
    // while the athlete shows absent.
    if (!student.isPresent) {
      const now = Date.now();
      await ctx.db.patch(studentId, { isPresent: true });
      await ctx.db.patch(existing._id, { checkedInAt: now, method });
      await logActivity(ctx, {
        type: "CHECKIN",
        message: `${student.fullName} is back on the floor! 🎮`,
        adminName: actorName,
        studentId,
        studentName: student.fullName,
      });
      await publishEvent(ctx, "player_status", { studentId, isPresent: true, ts: now });
      return { studentId, fullName: student.fullName, status: "OK" as const };
    }
    return { studentId, fullName: student.fullName, status: "ALREADY" as const };
  }

  const now = Date.now();
  const isReturn = !!existing; // checked out earlier today, coming back
  if (existing) {
    await ctx.db.patch(existing._id, { checkedInAt: now, checkedOutAt: null, method });
  } else {
    await ctx.db.insert("checkIns", {
      studentId,
      date,
      checkedInAt: now,
      method,
      byParentId: byParentId ?? null,
      byAdminName: byAdminName ?? null,
    });
  }
  await ctx.db.patch(studentId, { isPresent: true });

  await logActivity(ctx, {
    type: "CHECKIN",
    message: `${student.fullName} checked in — on the board and ready to play! 🎮`,
    adminName: actorName,
    studentId,
    studentName: student.fullName,
  });
  await publishEvent(ctx, "player_status", {
    studentId,
    isPresent: true,
    ts: now,
  });

  // Daily bonus only on the first check-in of the day
  if (!isReturn) {
    await applyPoints(
      ctx,
      studentId,
      CHECKIN_BONUS_POINTS,
      "CHECKIN",
      "Daily check-in bonus",
      actorName
    );
  }
  // A fresh check-in day can complete a rank's check-in requirement — promote
  // if so. (The first-of-day applyPoints above already re-evaluates; this also
  // covers same-day returns and check-in-only criteria.) Guarded no-op.
  await reevaluateRank(ctx, studentId);
  return { studentId, fullName: student.fullName, status: "OK" as const };
}

// Parent scans the front-desk QR (or NFC tag) and checks in linked kids.
export const checkInWithToken = mutation({
  args: {
    token: v.string(),
    sessionToken: v.string(),
    studentIds: v.array(v.id("students")),
    localDate: v.optional(v.string()),
    method: v.optional(v.union(v.literal("QR"), v.literal("NFC"))),
  },
  handler: async (ctx, args) => {
    const parent = await requireParent(ctx, args.sessionToken);
    const tokenRow = await ctx.db
      .query("checkinTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!tokenRow || tokenRow.expiresAt < Date.now()) {
      throw new Error("Check-in code expired — scan the QR on the front-desk screen again");
    }
    const method = args.method ?? (tokenRow.kind === "NFC_KIOSK" ? "NFC" : "QR");
    const date = resolveLocalDate(args.localDate);
    const results = [];
    for (const studentId of args.studentIds) {
      await requireParentLink(ctx, parent._id, studentId);
      results.push(
        await checkInStudent(ctx, studentId, date, method, parent.fullName, parent._id)
      );
    }
    return results;
  },
});

export const manualCheckIn = mutation({
  args: {
    studentId: v.id("students"),
    adminName: v.string(),
    localDate: v.optional(v.string()),
    method: v.optional(v.union(v.literal("QR"), v.literal("NFC"), v.literal("MANUAL"))),
  },
  handler: async (ctx, args) => {
    const date = resolveLocalDate(args.localDate);
    return await checkInStudent(
      ctx,
      args.studentId,
      date,
      args.method ?? "MANUAL",
      args.adminName,
      undefined,
      args.adminName
    );
  },
});

export const checkOut = mutation({
  args: {
    studentId: v.id("students"),
    localDate: v.optional(v.string()),
    adminName: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let actorName = args.adminName ?? "Front Desk";
    if (args.sessionToken) {
      const parent = await requireParent(ctx, args.sessionToken);
      await requireParentLink(ctx, parent._id, args.studentId);
      actorName = parent.fullName;
    }
    const date = resolveLocalDate(args.localDate);
    const row = await ctx.db
      .query("checkIns")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", date)
      )
      .unique();
    if (row && !row.checkedOutAt) {
      await ctx.db.patch(row._id, { checkedOutAt: Date.now() });
    }
    await ctx.db.patch(args.studentId, { isPresent: false });
    const student = await ctx.db.get(args.studentId);
    if (student) {
      await logActivity(ctx, {
        type: "CHECKOUT",
        message: `${student.fullName} checked out. See you next time! 👋`,
        adminName: actorName,
        studentId: args.studentId,
        studentName: student.fullName,
      });
    }
    return { ok: true };
  },
});

// ── Board & history queries ──────────────────────────────────────────────────

// Today's board: every check-in for the date joined with its student doc.
export const board = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const rows = await ctx.db
      .query("checkIns")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const out = [];
    for (const row of rows) {
      const student = await ctx.db.get(row.studentId);
      if (student) out.push({ checkIn: row, student });
    }
    return out.sort((a, b) => b.checkIn.checkedInAt - a.checkIn.checkedInAt);
  },
});

export const historyForStudent = query({
  args: { studentId: v.id("students"), limit: v.optional(v.number()) },
  handler: async (ctx, { studentId, limit }) => {
    return await ctx.db
      .query("checkIns")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(limit ?? 30);
  },
});

// Parent portal: recent check-ins across all linked kids.
export const historyForParent = query({
  args: { sessionToken: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, limit }) => {
    const parent = await requireParent(ctx, sessionToken);
    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .collect();
    const out = [];
    for (const link of links) {
      const student = await ctx.db.get(link.studentId);
      if (!student) continue;
      const rows = await ctx.db
        .query("checkIns")
        .withIndex("by_student", (q) => q.eq("studentId", link.studentId))
        .order("desc")
        .take(limit ?? 14);
      for (const row of rows) {
        out.push({ checkIn: row, studentName: student.fullName, studentId: student._id });
      }
    }
    return out.sort((a, b) => b.checkIn.checkedInAt - a.checkIn.checkedInAt);
  },
});
