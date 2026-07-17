import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { houseId } from "./schema";
import { logActivity, publishEvent } from "./helpers";

// House draft (admin only): stage house assignments for every enrolled
// student, balanced or hand-placed, and HOLD them until the coach reveals —
// manually or at a scheduled date. Students never pick their own house.

type HouseKey = "UNITY" | "SAGE" | "SPARK" | "VALOR";
const HOUSE_KEYS: HouseKey[] = ["UNITY", "SAGE", "SPARK", "VALOR"];

const getDraftRow = async (ctx: { db: any }) => {
  const rows = await ctx.db.query("houseDraft").collect();
  return rows[0] ?? null;
};

export const draft = query({
  args: {},
  handler: async (ctx) => {
    const row = await getDraftRow(ctx);
    if (!row) return null;
    return {
      assignments: row.assignments as Record<string, HouseKey>,
      revealAt: row.revealAt ?? null,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  },
});

const saveDraft = async (
  ctx: { db: any },
  assignments: Record<string, HouseKey>,
  updatedBy: string
) => {
  const row = await getDraftRow(ctx);
  if (row) {
    await ctx.db.patch(row._id, { assignments, updatedBy, updatedAt: Date.now() });
    return row._id;
  }
  return await ctx.db.insert("houseDraft", {
    assignments,
    revealAt: null,
    scheduledJobId: null,
    updatedBy,
    updatedAt: Date.now(),
  });
};

// Stage one student into a house (drag-and-drop / tap-assign).
export const assign = mutation({
  args: { studentId: v.id("students"), house: houseId, adminName: v.string() },
  handler: async (ctx, { studentId, house, adminName }) => {
    const row = await getDraftRow(ctx);
    const assignments = { ...((row?.assignments as Record<string, HouseKey>) ?? {}) };
    assignments[studentId] = house as HouseKey;
    await saveDraft(ctx, assignments, adminName);
    return { ok: true };
  },
});

// Balanced randomizer: shuffle every enrolled student and deal round-robin,
// so house sizes never differ by more than one.
export const randomize = mutation({
  args: { adminName: v.string() },
  handler: async (ctx, { adminName }) => {
    const students = await ctx.db.query("students").collect();
    const shuffled = [...students];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const startAt = Math.floor(Math.random() * HOUSE_KEYS.length);
    const assignments: Record<string, HouseKey> = {};
    shuffled.forEach((s, idx) => {
      assignments[s._id] = HOUSE_KEYS[(startAt + idx) % HOUSE_KEYS.length];
    });
    await saveDraft(ctx, assignments, adminName);
    await logActivity(ctx, {
      type: "SYSTEM",
      message: `House draft randomized (${students.length} players, balanced) by ${adminName} — held until reveal`,
      adminName,
    });
    return { ok: true, players: students.length };
  },
});

export const clearDraft = mutation({
  args: {},
  handler: async (ctx) => {
    const row = await getDraftRow(ctx);
    if (row) {
      if (row.scheduledJobId) {
        try { await ctx.scheduler.cancel(row.scheduledJobId as never); } catch { /* gone */ }
      }
      await ctx.db.delete(row._id);
    }
    return { ok: true };
  },
});

// Schedule the reveal for a coach-picked date/time.
export const scheduleReveal = mutation({
  args: { atMs: v.number(), adminName: v.string() },
  handler: async (ctx, { atMs, adminName }) => {
    const row = await getDraftRow(ctx);
    if (!row) throw new Error("No draft to schedule. Stage assignments first.");
    if (atMs < Date.now() + 30_000) throw new Error("Pick a time at least a minute out.");
    if (row.scheduledJobId) {
      try { await ctx.scheduler.cancel(row.scheduledJobId as never); } catch { /* gone */ }
    }
    const jobId = await ctx.scheduler.runAt(atMs, internal.houses.doReveal, { adminName });
    await ctx.db.patch(row._id, { revealAt: atMs, scheduledJobId: jobId as unknown as string });
    await logActivity(ctx, {
      type: "SYSTEM",
      message: `House reveal scheduled for ${new Date(atMs).toLocaleString()} by ${adminName}`,
      adminName,
    });
    return { ok: true, revealAt: atMs };
  },
});

export const cancelSchedule = mutation({
  args: {},
  handler: async (ctx) => {
    const row = await getDraftRow(ctx);
    if (row?.scheduledJobId) {
      try { await ctx.scheduler.cancel(row.scheduledJobId as never); } catch { /* gone */ }
      await ctx.db.patch(row._id, { revealAt: null, scheduledJobId: null });
    }
    return { ok: true };
  },
});

export const revealNow = mutation({
  args: { adminName: v.string() },
  handler: async (ctx, { adminName }) => {
    await ctx.scheduler.runAfter(0, internal.houses.doReveal, { adminName });
    return { ok: true };
  },
});

// The reveal: apply every staged assignment, celebrate, clear the draft.
export const doReveal = internalMutation({
  args: { adminName: v.string() },
  handler: async (ctx, { adminName }) => {
    const row = await getDraftRow(ctx);
    if (!row) return { ok: false, reason: "no draft" };
    const assignments = row.assignments as Record<string, HouseKey>;
    let moved = 0;
    for (const [studentId, house] of Object.entries(assignments)) {
      const student = await ctx.db.get(studentId as never);
      if (!student) continue;
      if ((student as { houseId?: string }).houseId !== house) moved++;
      await ctx.db.patch(studentId as never, { houseId: house } as never);
    }
    await ctx.db.delete(row._id);
    await logActivity(ctx, {
      type: "SYSTEM",
      message: `HOUSE REVEAL by ${adminName}: ${Object.keys(assignments).length} players placed (${moved} moved)`,
      adminName,
    });
    await publishEvent(ctx, "rank_up", {
      type: "BADGE_EARNED",
      studentName: "Fun 'N Fit Academy",
      achievement: "HOUSE REVEAL",
      message: "The houses are set! Check the board!",
      ts: Date.now(),
    });
    // Ping subscribed families too
    await ctx.scheduler.runAfter(0, internal.pushNode.deliver, {
      title: "House Reveal!",
      body: "The houses are set. Open the live board and find your colors!",
      url: "/#/live",
      tag: "fnf-reveal",
    });
    return { ok: true, players: Object.keys(assignments).length, moved };
  },
});
