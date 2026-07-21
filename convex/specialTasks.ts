import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { applyPoints, logActivity, reevaluateRank, requireParent, requireParentLink } from "./helpers";

// ── Catalog ──────────────────────────────────────────────────────────────────

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("specialTasks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("specialTasks").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    points: v.number(), // 0 for an XP-only task
    xp: v.optional(v.number()), // 0/omitted for a points-only task
    requiresProof: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("specialTasks", {
      title: args.title,
      description: args.description,
      points: args.points,
      xp: args.xp ?? 0,
      isActive: true,
      requiresProof: args.requiresProof ?? false,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("specialTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    points: v.optional(v.number()),
    xp: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    requiresProof: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(clean).length > 0) await ctx.db.patch(id, clean);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("specialTasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// ── Submissions ──────────────────────────────────────────────────────────────

export const submit = mutation({
  args: {
    sessionToken: v.string(),
    taskId: v.id("specialTasks"),
    studentId: v.id("students"),
    note: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await requireParent(ctx, args.sessionToken);
    await requireParentLink(ctx, parent._id, args.studentId);
    const task = await ctx.db.get(args.taskId);
    if (!task || !task.isActive) throw new Error("That task is no longer active");
    if (task.requiresProof && !args.photoUrl && !args.note) {
      throw new Error("This task needs proof — add a note or photo");
    }

    // One open submission per task per student
    const open = await ctx.db
      .query("taskSubmissions")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    if (open.some((s) => s.taskId === args.taskId && s.status === "PENDING")) {
      throw new Error("Already submitted — waiting on staff review");
    }

    const id = await ctx.db.insert("taskSubmissions", {
      taskId: args.taskId,
      studentId: args.studentId,
      byParentId: parent._id,
      note: args.note ?? null,
      photoUrl: args.photoUrl ?? null,
      status: "PENDING",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const submissionsForParent = query({
  args: { sessionToken: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, limit }) => {
    const parent = await requireParent(ctx, sessionToken);
    const rows = await ctx.db
      .query("taskSubmissions")
      .withIndex("by_parent", (q) => q.eq("byParentId", parent._id))
      .order("desc")
      .take(limit ?? 30);
    const out = [];
    for (const sub of rows) {
      const task = await ctx.db.get(sub.taskId);
      const student = await ctx.db.get(sub.studentId);
      out.push({
        submission: sub,
        taskTitle: task?.title ?? "(removed)",
        points: task?.points ?? 0,
        xp: task?.xp ?? 0,
        studentName: student?.fullName ?? "(removed)",
      });
    }
    return out;
  },
});

// Admin review queue (PENDING first, newest on top).
export const pending = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("taskSubmissions")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("desc")
      .collect();
    const out = [];
    for (const sub of rows) {
      const task = await ctx.db.get(sub.taskId);
      const student = await ctx.db.get(sub.studentId);
      const parent = await ctx.db.get(sub.byParentId);
      out.push({
        submission: sub,
        taskTitle: task?.title ?? "(removed)",
        points: task?.points ?? 0,
        xp: task?.xp ?? 0,
        studentName: student?.fullName ?? "(removed)",
        parentName: parent?.fullName ?? "(removed)",
      });
    }
    return out;
  },
});

export const review = mutation({
  args: {
    submissionId: v.id("taskSubmissions"),
    approve: v.boolean(),
    adminName: v.string(),
  },
  handler: async (ctx, { submissionId, approve, adminName }) => {
    const sub = await ctx.db.get(submissionId);
    if (!sub) throw new Error("Submission not found");
    if (sub.status !== "PENDING") throw new Error("Already reviewed");
    const task = await ctx.db.get(sub.taskId);

    await ctx.db.patch(submissionId, {
      status: approve ? "APPROVED" : "REJECTED",
      reviewedBy: adminName,
      reviewedAt: Date.now(),
    });

    if (approve && task) {
      const student = await ctx.db.get(sub.studentId);
      const pts = task.points ?? 0;
      const xp = task.xp ?? 0;
      const desc = `Task complete: ${task.title}`;

      // Points reward (skipXp: true so it does NOT auto-mirror XP — XP is granted
      // separately below, exactly the amount the coach configured).
      if (pts > 0) {
        await applyPoints(ctx, sub.studentId, pts, "SPECIAL_TASK", desc, adminName, undefined, undefined, true);
      }

      // XP reward (flat, the configured amount) — ledger it, lift lifetime XP,
      // then re-evaluate rank against the new total.
      if (xp > 0) {
        await ctx.db.insert("xpTransactions", {
          studentId: sub.studentId,
          amount: xp,
          sourceType: "SPECIAL_TASK",
          description: desc,
          createdAt: Date.now(),
        });
        const s2 = await ctx.db.get(sub.studentId);
        if (s2) await ctx.db.patch(sub.studentId, { totalXp: (s2.totalXp ?? 0) + xp });
      }

      if (student) {
        const parts: string[] = [];
        if (pts > 0) parts.push(`+${pts} pts`);
        if (xp > 0) parts.push(`+${xp} XP`);
        await logActivity(ctx, {
          type: "SPECIAL_TASK",
          message: `${student.fullName} completed "${task.title}" (${parts.join(" · ") || "no reward"}) ⭐`,
          adminName,
          studentId: sub.studentId,
          studentName: student.fullName,
          amount: pts,
        });
      }
      // This approval may have completed a rank's task requirement, and/or the XP
      // above may have crossed a threshold — promote if so. Guarded no-op when
      // nothing changed.
      await reevaluateRank(ctx, sub.studentId);
    }
    return await ctx.db.get(submissionId);
  },
});

// One-off: tasks created before the points/XP split gave points AND a coupled
// XP mirror. Backfill xp = points on those so they keep rewarding both under the
// new decoupled model (instead of silently dropping to points-only).
export const backfillXpFromPoints = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("specialTasks").collect();
    let patched = 0;
    for (const t of tasks) {
      if (t.xp === undefined) {
        await ctx.db.patch(t._id, { xp: t.points });
        patched++;
      }
    }
    return { patched };
  },
});
