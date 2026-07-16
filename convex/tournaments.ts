import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("tournaments")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    return docs.map((t) => ({
      id: t._id,
      name: t.name,
      type: t.type,
      status: t.status,
      startDate: t.startDate ?? undefined,
      endDate: t.endDate ?? undefined,
      maxParticipants: t.maxParticipants ?? undefined,
      seasonId: t.seasonId ?? undefined,
      prizePool: t.prizePool,
      createdBy: t.createdBy ?? undefined,
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("SINGLE_ELIM"),
      v.literal("DOUBLE_ELIM"),
      v.literal("ROUND_ROBIN"),
      v.literal("HOUSE_BATTLE")
    ),
    maxParticipants: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tournaments", {
      name: args.name,
      type: args.type,
      maxParticipants: args.maxParticipants,
      status: "REGISTRATION",
      createdAt: Date.now(),
    });
  },
});

export const details = query({
  args: { id: v.id("tournaments") },
  handler: async (ctx, { id }) => {
    const t = await ctx.db.get(id);
    if (!t) return null;

    const participantDocs = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", id))
      .collect();
    const matchDocs = await ctx.db
      .query("tournamentMatches")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", id))
      .collect();

    const participants = [];
    for (const p of participantDocs) {
      const student = await ctx.db.get(p.studentId);
      participants.push({
        id: p._id,
        tournamentId: p.tournamentId,
        studentId: p.studentId,
        seedPosition: p.seedPosition ?? undefined,
        finalPlacement: p.finalPlacement ?? undefined,
        pointsEarned: p.pointsEarned,
        joinedAt: new Date(p.joinedAt).toISOString(),
        student,
      });
    }

    const matches = [];
    for (const m of matchDocs) {
      const p1 = m.participant1Id ? await ctx.db.get(m.participant1Id) : null;
      const p2 = m.participant2Id ? await ctx.db.get(m.participant2Id) : null;
      matches.push({
        id: m._id,
        tournamentId: m.tournamentId,
        roundNumber: m.roundNumber,
        matchNumber: m.matchNumber,
        participant1Id: m.participant1Id ?? undefined,
        participant2Id: m.participant2Id ?? undefined,
        winnerId: m.winnerId ?? undefined,
        score1: m.score1 ?? undefined,
        score2: m.score2 ?? undefined,
        status: m.status,
        scheduledTime: m.scheduledTime ?? undefined,
        completedAt: m.completedAt ?? undefined,
        p1Student: p1 ? await ctx.db.get(p1.studentId) : null,
        p2Student: p2 ? await ctx.db.get(p2.studentId) : null,
      });
    }

    const tournament = {
      id: t._id,
      name: t.name,
      type: t.type,
      status: t.status,
      startDate: t.startDate ?? undefined,
      endDate: t.endDate ?? undefined,
      maxParticipants: t.maxParticipants ?? undefined,
      seasonId: t.seasonId ?? undefined,
      prizePool: t.prizePool,
      createdBy: t.createdBy ?? undefined,
    };

    return { tournament, participants, matches };
  },
});

export const join = mutation({
  args: { tournamentId: v.id("tournaments"), studentId: v.id("students") },
  handler: async (ctx, { tournamentId, studentId }) => {
    const existing = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    if (existing.some((p) => p.studentId === studentId)) {
      throw new Error("Student already joined this tournament");
    }
    await ctx.db.insert("tournamentParticipants", {
      tournamentId,
      studentId,
      pointsEarned: 0,
      joinedAt: Date.now(),
    });
  },
});

export const generateBracket = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const participants = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    if (participants.length < 2) throw new Error("Not enough participants");

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      await ctx.db.patch(shuffled[i]._id, { seedPosition: i + 1 });
    }

    const matchCount = Math.floor(shuffled.length / 2);
    for (let i = 0; i < matchCount; i++) {
      await ctx.db.insert("tournamentMatches", {
        tournamentId,
        roundNumber: 1,
        matchNumber: i + 1,
        participant1Id: shuffled[i * 2]._id,
        participant2Id: shuffled[i * 2 + 1]._id,
        status: "SCHEDULED",
      });
    }

    await ctx.db.patch(tournamentId, {
      status: "ACTIVE",
      startDate: new Date().toISOString(),
    });
  },
});

export const updateMatchResult = mutation({
  args: {
    matchId: v.id("tournamentMatches"),
    winnerId: v.id("tournamentParticipants"),
    score1: v.number(),
    score2: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.matchId, {
      winnerId: args.winnerId,
      score1: args.score1,
      score2: args.score2,
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    });
  },
});
