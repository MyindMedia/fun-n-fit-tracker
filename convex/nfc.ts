import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { applyPoints, logActivity, publishEvent, resolveLocalDate } from "./helpers";
import { checkInStudent } from "./checkins";

// NFC tags / wristbands. Tag UIDs live in students.deviceId, normalized to
// uppercase hex with no separators. One tag ↔ one student.

export function normalizeUid(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
}

async function findByTag(ctx: any, tagUid: string) {
  const uid = normalizeUid(tagUid);
  if (!uid) return null;
  // Roster sizes here are small (a gym's worth of kids); a scan is a hot path
  // but a full scan of <1k docs is fine and avoids a schema migration.
  const students = await ctx.db.query("students").collect();
  return students.find((s: any) => (s.deviceId ?? "") === uid) ?? null;
}

export const resolveTag = query({
  args: { tagUid: v.string() },
  handler: async (ctx, { tagUid }) => {
    return await findByTag(ctx, tagUid);
  },
});

// Roster of assignments for the admin manager.
export const tagRoster = query({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    return students.map((s) => ({
      studentId: s._id,
      fullName: s.fullName,
      houseId: s.houseId,
      avatarUrl: s.avatarUrl,
      tagUid: s.deviceId ?? null,
      hasWearable: s.hasWearable,
    }));
  },
});

export const assignTag = mutation({
  args: {
    studentId: v.id("students"),
    tagUid: v.string(),
    adminName: v.string(),
  },
  handler: async (ctx, { studentId, tagUid, adminName }) => {
    const uid = normalizeUid(tagUid);
    if (uid.length < 4) throw new Error("That scan doesn't look like a tag ID");

    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const existing = await findByTag(ctx, uid);
    if (existing && existing._id !== studentId) {
      throw new Error(`That tag is already assigned to ${existing.fullName} — unassign it first`);
    }

    await ctx.db.patch(studentId, { deviceId: uid, hasWearable: true });
    await logActivity(ctx, {
      type: "NFC_ASSIGN",
      message: `${student.fullName} got a wristband (tag …${uid.slice(-6)})`,
      adminName,
      studentId,
      studentName: student.fullName,
    });
    return { studentId, fullName: student.fullName, tagUid: uid };
  },
});

export const unassignTag = mutation({
  args: { studentId: v.id("students"), adminName: v.string() },
  handler: async (ctx, { studentId, adminName }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    await ctx.db.patch(studentId, { deviceId: null, hasWearable: false });
    await logActivity(ctx, {
      type: "NFC_ASSIGN",
      message: `${student.fullName}'s wristband was unassigned`,
      adminName,
      studentId,
      studentName: student.fullName,
    });
    return { ok: true };
  },
});

// Front-desk tap → full check-in ledger flow (board, Roll Call, daily bonus).
export const checkInByTag = mutation({
  args: {
    tagUid: v.string(),
    adminName: v.string(),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const student = await findByTag(ctx, args.tagUid);
    if (!student) {
      return { status: "UNKNOWN_TAG" as const, tagUid: normalizeUid(args.tagUid) };
    }
    const result = await checkInStudent(
      ctx,
      student._id,
      resolveLocalDate(args.localDate),
      "NFC",
      args.adminName,
      undefined,
      args.adminName
    );
    await ctx.db.insert("nfcScans", {
      ts: Date.now(),
      kind: "CHECKIN",
      tagUid: normalizeUid(args.tagUid),
      studentId: student._id,
      studentName: student.fullName,
      houseId: student.houseId,
      actor: args.adminName,
    });
    return {
      status: result.status, // OK | ALREADY
      studentId: student._id,
      fullName: student.fullName,
      houseId: student.houseId,
      avatarUrl: student.avatarUrl,
      points: student.points,
    };
  },
});

// ── Local reader agent bridge ────────────────────────────────────────────────
// PC/SC readers (ACR1252U etc.) can't type like keyboard-wedge models, so a
// tiny local agent (scripts/nfc-agent.mjs) reads them natively and pushes
// scans here; the open NFC Bands page subscribes and treats them exactly like
// wedge scans. Events ride the existing ephemeral appEvents bus.

export const pushScan = mutation({
  args: { tagUid: v.string(), readerId: v.optional(v.string()) },
  handler: async (ctx, { tagUid, readerId }) => {
    const uid = normalizeUid(tagUid);
    if (uid.length < 4) return { ok: false };
    await publishEvent(ctx, "nfc_scan", { uid, readerId: readerId ?? "usb-reader", ts: Date.now() });
    return { ok: true };
  },
});

// Agent presence: heartbeat on connect + every ~20s so the UI can show the
// reader as online by name the moment it's plugged in (and offline when the
// heartbeats stop). Stored in appSettings (single row, no event spam).
export const pushHeartbeat = mutation({
  args: { readerId: v.string(), online: v.optional(v.boolean()) },
  handler: async (ctx, { readerId, online }) => {
    const value = JSON.stringify({ readerId, ts: Date.now(), online: online ?? true });
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "nfc_reader_status"))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    else await ctx.db.insert("appSettings", { key: "nfc_reader_status", value, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const readerStatus = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "nfc_reader_status"))
      .unique();
    if (!row) return null;
    try {
      return JSON.parse(row.value) as { readerId: string; ts: number; online: boolean };
    } catch {
      return null;
    }
  },
});

export const latestScans = query({
  args: { sinceTs: v.number() },
  handler: async (ctx, { sinceTs }) => {
    const events = await ctx.db
      .query("appEvents")
      .withIndex("by_ts", (q) => q.gt("ts", sinceTs))
      .collect();
    return events
      .filter((e) => e.kind === "nfc_scan")
      .map((e) => ({ id: e._id, ...(e.payload as any) }));
  },
});

// Coach scoring tap: award a preset amount to whoever owns the tag. Runs
// through applyPoints (rank logic, ledger, celebrations) like every award.
export const awardByTag = mutation({
  args: {
    tagUid: v.string(),
    amount: v.number(),
    description: v.string(),
    adminName: v.string(),
    sessionId: v.optional(v.id("gameSessions")),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, { tagUid, amount, description, adminName, sessionId, localDate }) => {
    const student = await findByTag(ctx, tagUid);
    if (!student) {
      return { status: "UNKNOWN_TAG" as const, tagUid: normalizeUid(tagUid) };
    }
    // A scan proves they're in the building: auto-check-in if Roll Call
    // doesn't have them yet (daily bonus included, same ledger as the door).
    let checkedIn = false;
    if (!student.isPresent) {
      await checkInStudent(ctx, student._id, resolveLocalDate(localDate), "NFC", adminName, undefined, adminName);
      checkedIn = true;
    }
    const session = sessionId ? await ctx.db.get(sessionId) : null;
    const result = await applyPoints(
      ctx,
      student._id,
      amount,
      "MANUAL",
      description || (session ? `${session.title} (NFC)` : "NFC scan award"),
      adminName
    );
    await ctx.db.insert("nfcScans", {
      ts: Date.now(),
      kind: "AWARD",
      tagUid: normalizeUid(tagUid),
      studentId: student._id,
      studentName: student.fullName,
      houseId: student.houseId,
      sessionId: sessionId ?? null,
      gameTitle: session?.title ?? null,
      amount,
      actor: adminName,
    });
    return {
      status: "OK" as const,
      studentId: student._id,
      fullName: student.fullName,
      houseId: student.houseId,
      avatarUrl: student.avatarUrl,
      amount,
      finalPoints: result.finalPoints,
      didRankUp: result.didRankUp,
      checkedIn,
    };
  },
});

// Game/timing tap: timestamped scan per student. When tied to a live game
// session, the split vs that student's previous scan in the same session is
// computed server-side — lap times, relay legs, checkpoint circuits.
export const gameScanByTag = mutation({
  args: {
    tagUid: v.string(),
    adminName: v.string(),
    sessionId: v.optional(v.id("gameSessions")),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, { tagUid, adminName, sessionId, localDate }) => {
    const student = await findByTag(ctx, tagUid);
    const ts = Date.now();
    if (!student) {
      return { status: "UNKNOWN_TAG" as const, tagUid: normalizeUid(tagUid), ts };
    }

    // First scan of the day marks them Here on Roll Call automatically.
    let checkedIn = false;
    if (!student.isPresent) {
      await checkInStudent(ctx, student._id, resolveLocalDate(localDate), "NFC", adminName, undefined, adminName);
      checkedIn = true;
    }

    const session = sessionId ? await ctx.db.get(sessionId) : null;
    let splitMs: number | null = null;
    let lap = 1;
    if (sessionId) {
      const prior = await ctx.db
        .query("nfcScans")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
      const mine = prior.filter((s) => s.studentId === student._id && s.kind === "GAME");
      if (mine.length > 0) {
        const last = mine[mine.length - 1];
        splitMs = ts - last.ts;
      }
      lap = mine.length + 1;
    }

    await ctx.db.insert("nfcScans", {
      ts,
      kind: "GAME",
      tagUid: normalizeUid(tagUid),
      studentId: student._id,
      studentName: student.fullName,
      houseId: student.houseId,
      sessionId: sessionId ?? null,
      gameTitle: session?.title ?? null,
      splitMs,
      actor: adminName,
    });
    await publishEvent(ctx, "lap_time", {
      studentId: student._id,
      studentName: student.fullName,
      houseId: student.houseId,
      source: "NFC",
      splitMs,
      lap,
      ts,
    });
    await logActivity(ctx, {
      type: "LAP_TIME",
      message: splitMs
        ? `${student.fullName} — lap ${lap - 1} in ${(splitMs / 1000).toFixed(1)}s${session ? ` (${session.title})` : ""}`
        : `${student.fullName} is on the clock${session ? ` (${session.title})` : ""}`,
      adminName,
      studentId: student._id,
      studentName: student.fullName,
    });
    return {
      status: "OK" as const,
      studentId: student._id,
      fullName: student.fullName,
      houseId: student.houseId,
      avatarUrl: student.avatarUrl,
      ts,
      splitMs,
      lap,
      checkedIn,
    };
  },
});

// Live splits board for a session (Timing mode leaderboard).
export const sessionScans = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("nfcScans")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});
