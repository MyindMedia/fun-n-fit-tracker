import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { applyPoints, logActivity, requireParent, requireParentLink } from "./helpers";

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
    points: v.number(),
    requiresProof: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("specialTasks", {
      title: args.title,
      description: args.description,
      points: args.points,
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
      await applyPoints(
        ctx,
        sub.studentId,
        task.points,
        "SPECIAL_TASK",
        `Task complete: ${task.title}`,
        adminName
      );
      if (student) {
        await logActivity(ctx, {
          type: "SPECIAL_TASK",
          message: `${student.fullName} completed "${task.title}" (+${task.points} pts) ⭐`,
          adminName,
          studentId: sub.studentId,
          studentName: student.fullName,
          amount: task.points,
        });
      }
    }
    return await ctx.db.get(submissionId);
  },
});
