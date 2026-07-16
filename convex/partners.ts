import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  applyPoints,
  logActivity,
  randomToken,
  requireParent,
  requireParentLink,
  resolveLocalDate,
} from "./helpers";

// ── Public directory (parent/student portals — never leaks qrSecret) ────────

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("partnerBusinesses")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return rows.map(({ qrSecret: _secret, ...pub }) => pub);
  },
});

// Parent scanned a business QR: preview before confirming the visit.
export const resolveSecret = query({
  args: { qrSecret: v.string() },
  handler: async (ctx, { qrSecret }) => {
    const business = await ctx.db
      .query("partnerBusinesses")
      .withIndex("by_secret", (q) => q.eq("qrSecret", qrSecret))
      .unique();
    if (!business || !business.isActive) return null;
    return {
      id: business._id,
      name: business.name,
      description: business.description ?? undefined,
      pointsReward: business.pointsReward,
    };
  },
});

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("partnerBusinesses").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    address: v.optional(v.string()),
    pointsReward: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("partnerBusinesses", {
      name: args.name,
      description: args.description ?? null,
      category: args.category ?? null,
      address: args.address ?? null,
      logoUrl: null,
      pointsReward: args.pointsReward,
      qrSecret: randomToken(12),
      isActive: true,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("partnerBusinesses"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    address: v.optional(v.string()),
    pointsReward: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
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
  args: { id: v.id("partnerBusinesses") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const rotateSecret = mutation({
  args: { id: v.id("partnerBusinesses") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { qrSecret: randomToken(12) });
    return await ctx.db.get(id);
  },
});

// ── Visits ───────────────────────────────────────────────────────────────────

// Parent scanned a business QR and confirms which kids are visiting.
// One rewarded visit per student per business per day.
export const recordVisit = mutation({
  args: {
    sessionToken: v.string(),
    qrSecret: v.string(),
    studentIds: v.array(v.id("students")),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await requireParent(ctx, args.sessionToken);
    const business = await ctx.db
      .query("partnerBusinesses")
      .withIndex("by_secret", (q) => q.eq("qrSecret", args.qrSecret))
      .unique();
    if (!business || !business.isActive) {
      throw new Error("That business code isn't active — ask the staff for a fresh QR");
    }
    const date = resolveLocalDate(args.localDate);
    const results = [];
    for (const studentId of args.studentIds) {
      await requireParentLink(ctx, parent._id, studentId);
      const student = await ctx.db.get(studentId);
      if (!student) continue;
      const dup = await ctx.db
        .query("businessVisits")
        .withIndex("by_student_business_date", (q) =>
          q.eq("studentId", studentId).eq("businessId", business._id).eq("date", date)
        )
        .unique();
      if (dup) {
        results.push({ studentId, fullName: student.fullName, status: "ALREADY" as const });
        continue;
      }
      await ctx.db.insert("businessVisits", {
        studentId,
        businessId: business._id,
        points: business.pointsReward,
        date,
        byParentId: parent._id,
        verifiedBy: "PARENT_QR",
        createdAt: Date.now(),
      });
      await applyPoints(
        ctx,
        studentId,
        business.pointsReward,
        "PARTNER_VISIT",
        `Visited ${business.name}`,
        parent.fullName
      );
      await logActivity(ctx, {
        type: "PARTNER_VISIT",
        message: `${student.fullName} earned ${business.pointsReward} pts visiting ${business.name}! 🏪`,
        adminName: parent.fullName,
        studentId,
        studentName: student.fullName,
        amount: business.pointsReward,
      });
      results.push({
        studentId,
        fullName: student.fullName,
        status: "OK" as const,
        points: business.pointsReward,
      });
    }
    return { business: { id: business._id, name: business.name }, results };
  },
});

export const visitsForParent = query({
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
      const visits = await ctx.db
        .query("businessVisits")
        .withIndex("by_student", (q) => q.eq("studentId", link.studentId))
        .order("desc")
        .take(limit ?? 20);
      for (const visit of visits) {
        const business = await ctx.db.get(visit.businessId);
        out.push({
          visit,
          studentName: student.fullName,
          businessName: business?.name ?? "(removed)",
        });
      }
    }
    return out.sort((a, b) => b.visit.createdAt - a.visit.createdAt);
  },
});

export const visitsForStudent = query({
  args: { studentId: v.id("students"), limit: v.optional(v.number()) },
  handler: async (ctx, { studentId, limit }) => {
    const visits = await ctx.db
      .query("businessVisits")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(limit ?? 20);
    const out = [];
    for (const visit of visits) {
      const business = await ctx.db.get(visit.businessId);
      out.push({ visit, businessName: business?.name ?? "(removed)" });
    }
    return out;
  },
});
