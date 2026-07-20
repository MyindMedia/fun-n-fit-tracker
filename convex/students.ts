import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { houseId } from "./schema";
import { logActivity, studentDefaults } from "./helpers";
import { BADGES } from "../constants";
import { voltEffects } from "../voltCatalog";

export const list = query({
  // Active roster by default. Archived (departed/ejected) athletes are hidden
  // unless includeArchived is set (the archive-management view passes it).
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { includeArchived }) => {
    const students = await ctx.db.query("students").collect();
    const visible = includeArchived ? students : students.filter((s) => !s.archived);
    return visible.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

// Just the archived athletes, for the admin archive-management view.
export const archivedList = query({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    return students
      .filter((s) => s.archived)
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  },
});

export const get = query({
  args: { id: v.id("students") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const add = mutation({
  args: {
    fullName: v.string(),
    houseId: houseId,
    gender: v.union(v.literal("Male"), v.literal("Female")),
    gamerTag: v.optional(v.string()),
    deviceId: v.optional(v.union(v.string(), v.null())),
    avatarUrl: v.optional(v.string()),
    isPresent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const defaults = studentDefaults(args.fullName);
    const id = await ctx.db.insert("students", {
      ...defaults,
      fullName: args.fullName,
      houseId: args.houseId,
      gender: args.gender,
      gamerTag: args.gamerTag || "",
      deviceId: args.deviceId ?? undefined,
      displayPreference: "FULL_NAME",
      avatarUrl: args.avatarUrl || defaults.avatarUrl,
      isPresent: args.isPresent ?? defaults.isPresent,
      friendIds: [],
      totalXp: 0,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("students"),
    fullName: v.optional(v.string()),
    houseId: v.optional(houseId),
    gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
    avatarUrl: v.optional(v.string()),
    gamerTag: v.optional(v.string()),
    displayPreference: v.optional(
      v.union(v.literal("FULL_NAME"), v.literal("GAMER_TAG"), v.literal("INITIALS"))
    ),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

// Archive a departed/ejected athlete. Soft: keeps the record and the whole
// transaction ledger, so the house KEEPS the points the kid earned this season
// (house totals sum the ledger by houseId). Just hides them from active rosters
// and boards and marks them not-present. Reversible with restore.
export const archive = mutation({
  args: { id: v.id("students"), adminName: v.string() },
  handler: async (ctx, { id, adminName }) => {
    const student = await ctx.db.get(id);
    if (!student) return;
    await ctx.db.patch(id, { archived: true, archivedAt: Date.now(), isPresent: false });
    await logActivity(ctx, {
      type: "ACCOUNT_DELETE",
      message: `Archived ${student.fullName || "Athlete"} (points kept for the team)`,
      adminName,
    });
  },
});

// Bring an archived athlete back onto the active roster.
export const restore = mutation({
  args: { id: v.id("students"), adminName: v.string() },
  handler: async (ctx, { id, adminName }) => {
    const student = await ctx.db.get(id);
    if (!student) return;
    await ctx.db.patch(id, { archived: false, archivedAt: null });
    await logActivity(ctx, {
      type: "POINTS",
      message: `Restored ${student.fullName || "Athlete"} to the active roster`,
      adminName,
    });
  },
});

// Permanent hard delete (test/duplicate records). This DOES remove the ledger,
// so the house loses those points. For a departing real athlete use `archive`.
export const remove = mutation({
  args: { id: v.id("students"), adminName: v.string() },
  handler: async (ctx, { id, adminName }) => {
    const student = await ctx.db.get(id);
    if (!student) return;

    // Cascade: clean up everything referencing this student
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const t of txs) await ctx.db.delete(t._id);

    const xps = await ctx.db
      .query("xpTransactions")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const x of xps) await ctx.db.delete(x._id);

    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

    const owned = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const w of owned) await ctx.db.delete(w._id);

    const avatars = await ctx.db
      .query("studentAvatars")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const a of avatars) await ctx.db.delete(a._id);

    const challenges = await ctx.db
      .query("studentChallenges")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const c of challenges) await ctx.db.delete(c._id);

    const participations = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const p of participations) await ctx.db.delete(p._id);

    const congrats = await ctx.db
      .query("pendingCelebrations")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const c of congrats) await ctx.db.delete(c._id);

    const access = await ctx.db
      .query("portalAccess")
      .withIndex("by_student", (q) => q.eq("studentId", id))
      .collect();
    for (const a of access) await ctx.db.delete(a._id);

    await ctx.db.delete(id);
    await logActivity(ctx, {
      type: "ACCOUNT_DELETE",
      message: `Deleted ${student.fullName || "Athlete"}`,
      adminName,
    });
  },
});

export const setPresent = mutation({
  args: {
    id: v.id("students"),
    present: v.boolean(),
    adminName: v.optional(v.string()),
  },
  handler: async (ctx, { id, present, adminName }) => {
    await ctx.db.patch(id, { isPresent: present });
    if (adminName) {
      await logActivity(ctx, {
        type: "POINTS",
        message: present ? "Checked In" : "Marked Absent",
        adminName,
      });
    }
  },
});

export const toggleAttendance = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, { id }) => {
    const student = await ctx.db.get(id);
    if (!student) throw new Error("Student not found");
    await ctx.db.patch(id, { isPresent: !student.isPresent });
  },
});

export const resetPresence = mutation({
  args: { adminName: v.string() },
  handler: async (ctx, { adminName }) => {
    const students = await ctx.db.query("students").collect();
    for (const s of students) {
      if (s.isPresent) await ctx.db.patch(s._id, { isPresent: false });
    }
    await logActivity(ctx, {
      type: "POINTS",
      message: "Roll Call Reset (All set to inactive)",
      adminName,
    });
  },
});

export const addFriend = mutation({
  args: { studentId: v.id("students"), friendId: v.string() },
  handler: async (ctx, { studentId, friendId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const friendIds = student.friendIds ?? [];
    if (!friendIds.includes(friendId)) {
      await ctx.db.patch(studentId, { friendIds: [...friendIds, friendId] });
    }
  },
});

export const removeFriend = mutation({
  args: { studentId: v.id("students"), friendId: v.string() },
  handler: async (ctx, { studentId, friendId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const friendIds = (student.friendIds ?? []).filter((f) => f !== friendId);
    await ctx.db.patch(studentId, { friendIds });
  },
});

export const friends = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student?.friendIds?.length) return [];
    const results = [];
    for (const fid of student.friendIds) {
      const friend = await ctx.db.get(fid as typeof studentId);
      if (friend) results.push(friend);
    }
    return results;
  },
});

export const awardBadge = mutation({
  args: {
    studentId: v.id("students"),
    badgeKey: v.string(),
    adminName: v.string(),
  },
  handler: async (ctx, { studentId, badgeKey, adminName }) => {
    const student = await ctx.db.get(studentId);
    if (!student) return;
    if (student.badges.includes(badgeKey)) return;

    const badgeDoc = await ctx.db
      .query("badges")
      .withIndex("by_key", (q) => q.eq("key", badgeKey))
      .unique();
    const badge = badgeDoc ?? BADGES.find((b) => b.id === badgeKey);
    if (!badge) return;

    await ctx.db.patch(studentId, { badges: [...student.badges, badgeKey] });
    await logActivity(ctx, {
      type: "BADGE_EARNED",
      message: `Achievement Unlocked: ${badge.name}!`,
      adminName,
      studentId,
      studentName: student.fullName,
    });
  },
});

export const redeemReward = mutation({
  args: { studentId: v.id("students"), rewardKey: v.string() },
  handler: async (ctx, { studentId, rewardKey }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const reward = await ctx.db
      .query("rewards")
      .withIndex("by_key", (q) => q.eq("key", rewardKey))
      .unique();
    if (!reward) throw new Error("Reward not found in database.");
    if (student.points < reward.cost) throw new Error("Insufficient points.");

    await ctx.db.patch(studentId, {
      points: student.points - reward.cost,
      inventory: [...student.inventory, rewardKey],
    });
    await logActivity(ctx, {
      type: "REWARD_CLAIMED",
      message: `Redeemed: ${reward.name}!`,
      adminName: "System",
      studentId,
      studentName: student.fullName,
    });
  },
});

export const purchaseWearable = mutation({
  args: {
    studentId: v.id("students"),
    wearableId: v.string(),
    cost: v.number(),
  },
  handler: async (ctx, { studentId, wearableId, cost }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    // Volt shop discount (Piggy Bank perk / Team Captain specialty)
    const discountPct = voltEffects(student.voltLoadout).shopDiscountPct;
    cost = Math.max(1, Math.round(cost * (1 - discountPct / 100)));
    if (student.points < cost) {
      throw new Error("Insufficient Funds: not enough points to purchase this item.");
    }

    const owned = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    if (owned.some((w) => w.wearableId === wearableId)) {
      throw new Error("Already Owned: you already own this item.");
    }

    await ctx.db.patch(studentId, { points: student.points - cost });
    await ctx.db.insert("studentWearables", {
      studentId,
      wearableId,
      acquiredAt: Date.now(),
    });
    await ctx.db.insert("transactions", {
      studentId,
      amount: -cost,
      sourceType: "STORE_PURCHASE",
      description: "Purchased wearable item",
      createdAt: Date.now(),
    });
  },
});

export const inventory = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const owned = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    return owned.map((w) => w.wearableId);
  },
});

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const demo = [
      { fullName: "Alex Rivera", houseId: "UNITY" as const, gender: "Male" as const, points: 120, rankId: "r_rookie" },
      { fullName: "Sarah Chen", houseId: "SAGE" as const, gender: "Female" as const, points: 450, rankId: "r_challenger" },
    ];
    for (const s of demo) {
      await ctx.db.insert("students", {
        ...studentDefaults(s.fullName),
        ...s,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.fullName}`,
        friendIds: [],
        totalXp: 0,
      });
    }
    await logActivity(ctx, {
      type: "ENROLL",
      message: "System seeded with demo athletes.",
      adminName: "System",
    });
  },
});
