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

// Coach scoring tap: award a preset amount to whoever owns the tag. Runs
// through applyPoints (rank logic, ledger, celebrations) like every award.
export const awardByTag = mutation({
  args: {
    tagUid: v.string(),
    amount: v.number(),
    description: v.string(),
    adminName: v.string(),
  },
  handler: async (ctx, { tagUid, amount, description, adminName }) => {
    const student = await findByTag(ctx, tagUid);
    if (!student) {
      return { status: "UNKNOWN_TAG" as const, tagUid: normalizeUid(tagUid) };
    }
    const result = await applyPoints(
      ctx,
      student._id,
      amount,
      "MANUAL",
      description || "NFC scan award",
      adminName
    );
    return {
      status: "OK" as const,
      studentId: student._id,
      fullName: student.fullName,
      houseId: student.houseId,
      avatarUrl: student.avatarUrl,
      amount,
      finalPoints: result.finalPoints,
      didRankUp: result.didRankUp,
    };
  },
});

// Game/timing tap: timestamped scan event per student. Consecutive scans give
// lap splits; the live board's existing lap_time listener picks these up.
export const gameScanByTag = mutation({
  args: { tagUid: v.string(), adminName: v.string() },
  handler: async (ctx, { tagUid, adminName }) => {
    const student = await findByTag(ctx, tagUid);
    const ts = Date.now();
    if (!student) {
      return { status: "UNKNOWN_TAG" as const, tagUid: normalizeUid(tagUid), ts };
    }
    await publishEvent(ctx, "lap_time", {
      studentId: student._id,
      studentName: student.fullName,
      houseId: student.houseId,
      source: "NFC",
      ts,
    });
    await logActivity(ctx, {
      type: "LAP_TIME",
      message: `${student.fullName} tapped the timing pad`,
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
    };
  },
});
