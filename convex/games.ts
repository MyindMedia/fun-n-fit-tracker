import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivity, publishEvent } from "./helpers";
import { GAME_LIBRARY } from "../constants";

export const active = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("gameSessions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const history = query({
  args: {},
  handler: async (ctx) => {
    const finished = await ctx.db
      .query("gameSessions")
      .withIndex("by_active", (q) => q.eq("isActive", false))
      .collect();
    return finished.sort((a, b) => b.endTime - a.endTime);
  },
});

export const get = query({
  args: { id: v.id("gameSessions") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Small window over the most recently finished sessions; subscribed by clients
// to detect game_end (replaces the postgres_changes UPDATE feed).
export const recentFinished = query({
  args: {},
  handler: async (ctx) => {
    const finished = await ctx.db
      .query("gameSessions")
      .withIndex("by_active", (q) => q.eq("isActive", false))
      .collect();
    return finished.sort((a, b) => b.endTime - a.endTime).slice(0, 5);
  },
});

export const start = mutation({
  args: {
    gameKey: v.string(),
    adminName: v.string(),
    roster: v.array(v.string()),
    durationSeconds: v.number(),
    customTitle: v.optional(v.string()),
    captureMode: v.optional(v.union(v.literal("MANUAL"), v.literal("NFC"))),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let title = args.gameKey;
    const def = await ctx.db
      .query("gameLibrary")
      .withIndex("by_gameKey", (q) => q.eq("gameKey", args.gameKey))
      .unique();
    if (def) {
      title = def.displayName;
    } else {
      const local = GAME_LIBRARY.find((g) => g.gameKey === args.gameKey);
      if (local) title = local.displayName;
    }
    if (args.customTitle && args.customTitle.trim()) {
      title = args.customTitle.trim();
    }

    const startTime = Date.now() + 3000;
    const endTime = startTime + args.durationSeconds * 1000;

    const id = await ctx.db.insert("gameSessions", {
      gameKey: args.gameKey,
      title,
      startTime,
      endTime,
      isActive: true,
      startedBy: args.adminName,
      roster: args.roster,
      captureMode: args.captureMode ?? "MANUAL",
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      type: "POINTS",
      message: `Launch: ${title}`,
      adminName: args.adminName,
    });

    await publishEvent(
      ctx,
      "game_start",
      {
        id,
        title,
        startTime,
        endTime,
        durationSeconds: args.durationSeconds,
        ts: Date.now(),
      },
      args.clientId
    );

    return await ctx.db.get(id);
  },
});

export const stop = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, clientId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    // Score the session from the points ledger recorded during the game window
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", session.startTime).lte("createdAt", session.endTime)
      )
      .collect();

    const roster = new Set(session.roster);
    const houseScores: Record<string, number> = {};
    const studentScores: Record<string, number> = {};

    for (const t of txs) {
      if (!roster.has(t.studentId)) continue;
      const student = await ctx.db.get(t.studentId);
      if (!student) continue;
      houseScores[student.houseId] = (houseScores[student.houseId] || 0) + t.amount;
      studentScores[t.studentId] = (studentScores[t.studentId] || 0) + t.amount;
    }

    const winningHouseId =
      (Object.entries(houseScores).sort((a, b) => b[1] - a[1])[0]?.[0] as
        | "UNITY"
        | "SAGE"
        | "SPARK"
        | "VALOR"
        | undefined) ?? null;
    const mvpStudentId =
      Object.entries(studentScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const results = {
      winningHouseId,
      winningHouseScore: winningHouseId ? houseScores[winningHouseId] : 0,
      mvpStudentId,
      mvpStudentScore: mvpStudentId ? studentScores[mvpStudentId] : 0,
      outs: session.results?.outs ?? {},
    };

    await ctx.db.patch(sessionId, {
      isActive: false,
      results,
      endTime: Date.now(),
    });

    await logActivity(ctx, {
      type: "GAME_END",
      message: `${session.title} Over`,
      adminName: session.startedBy,
    });

    await publishEvent(
      ctx,
      "game_end",
      { id: sessionId, game: { title: session.title }, results, ts: Date.now() },
      clientId
    );

    const updated = await ctx.db.get(sessionId);
    return { session: updated, results };
  },
});

export const togglePlayerStatus = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    studentId: v.string(),
    isOut: v.boolean(),
    adminName: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    const current = session.results ?? {};
    const outs = { ...(current.outs ?? {}) };
    outs[args.studentId] = args.isOut;
    await ctx.db.patch(args.sessionId, { results: { ...current, outs } });

    await publishEvent(
      ctx,
      "player_status",
      { sessionId: args.sessionId, studentId: args.studentId, isOut: args.isOut },
      args.clientId
    );

    await logActivity(ctx, {
      type: "POINTS",
      message: `${args.isOut ? "OUT" : "IN"}: status changed`,
      adminName: args.adminName,
      studentId: args.studentId,
      amount: 0,
    });
  },
});

export const drillLeaderboard = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", session.startTime))
      .collect();

    const roster = new Set(session.roster);
    const houseScores: Record<string, number> = {
      UNITY: 0,
      SAGE: 0,
      SPARK: 0,
      VALOR: 0,
    };
    const studentScores: Record<string, number> = {};
    const studentDocs: Record<string, unknown> = {};

    for (const t of txs) {
      if (!roster.has(t.studentId)) continue;
      const student = await ctx.db.get(t.studentId);
      if (!student) continue;
      studentScores[t.studentId] = (studentScores[t.studentId] || 0) + t.amount;
      houseScores[student.houseId] += t.amount;
      studentDocs[t.studentId] = student;
    }

    const top = Object.entries(studentScores)
      .map(([id, score]) => ({ student: studentDocs[id], drillScore: score }))
      .filter((e) => e.student)
      .sort((a, b) => b.drillScore - a.drillScore)
      .slice(0, 3);

    return { students: top, houses: houseScores };
  },
});

// ── Drill presets ────────────────────────────────────────────────────────────

export const savePreset = mutation({
  args: {
    name: v.string(),
    gameKey: v.string(),
    defaultDuration: v.number(),
    defaultRoster: v.array(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("drillPresets", { ...args, createdAt: Date.now() });
  },
});

export const presets = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("drillPresets")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
  },
});

export const getPreset = query({
  args: { id: v.id("drillPresets") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const deletePreset = mutation({
  args: { id: v.id("drillPresets") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
