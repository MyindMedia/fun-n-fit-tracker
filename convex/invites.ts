import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { logActivity, randomToken } from "./helpers";

// Parent sign-up invites. Creating an invite pre-creates the parent record
// (matched by email — same key clerkBridge uses) and links the athlete(s),
// so the kid is already on screen the first time the parent signs in. The
// invite link just personalizes the sign-in page; the email does the linking.

export const PORTAL_INVITE_BASE = "https://fnffinal.netlify.app/#/parent-login";

type CreateArgs = {
  email: string;
  fullName: string;
  studentIds: string[];
  invitedBy: string;
};

async function createInviteImpl(ctx: any, args: CreateArgs) {
  const email = args.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("That doesn't look like a valid email address");
  }
  const fullName = args.fullName.trim() || email.split("@")[0];

  // Pre-create the parent (Clerk-only account: unusable random password).
  let parent = await ctx.db
    .query("parents")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
  if (!parent) {
    const parentId = await ctx.db.insert("parents", {
      email,
      fullName,
      phone: null,
      passwordHash: randomToken(32),
      salt: randomToken(16),
      createdAt: Date.now(),
    });
    parent = await ctx.db.get(parentId);
  }

  // Link the athletes (skip ones already linked), collect first names for the email.
  const kidNames: string[] = [];
  for (const sid of args.studentIds) {
    const student = await ctx.db.get(sid as Id<"students">);
    if (!student) continue;
    kidNames.push(student.fullName.split(" ")[0]);
    const link = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent_student", (q: any) =>
        q.eq("parentId", parent!._id).eq("studentId", student._id)
      )
      .unique();
    if (!link) {
      await ctx.db.insert("parentStudentLinks", {
        parentId: parent!._id,
        studentId: student._id,
        createdAt: Date.now(),
      });
    }
  }

  const token = randomToken(16);
  await ctx.db.insert("parentInvites", {
    email,
    fullName,
    studentIds: args.studentIds,
    token,
    status: "PENDING",
    invitedBy: args.invitedBy,
    createdAt: Date.now(),
  });

  const url = `${PORTAL_INVITE_BASE}?invite=${token}`;

  await ctx.scheduler.runAfter(0, internal.email.sendParentInvite, {
    email,
    fullName,
    inviteUrl: url,
    kidNames,
  });
  await logActivity(ctx, {
    type: "ENROLL",
    message: `Portal invite sent to ${fullName} (${email})`,
    adminName: args.invitedBy,
  });

  return { token, url, email, kidNames };
}

// Admin UI entry point.
export const create = mutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    studentIds: v.array(v.id("students")),
    adminName: v.string(),
  },
  handler: async (ctx, args) =>
    await createInviteImpl(ctx, {
      email: args.email,
      fullName: args.fullName,
      studentIds: args.studentIds,
      invitedBy: args.adminName,
    }),
});

// Webhook entry point (GoHighLevel) — students referenced by name.
export const createFromWebhook = internalMutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    studentNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const students = await ctx.db.query("students").collect();
    const ids: string[] = [];
    const unmatched: string[] = [];
    for (const name of args.studentNames) {
      const needle = name.toLowerCase().trim();
      const hit = students.find((s) => s.fullName.toLowerCase().trim() === needle);
      if (hit) ids.push(hit._id);
      else if (needle) unmatched.push(name);
    }
    const res = await createInviteImpl(ctx, {
      email: args.email,
      fullName: args.fullName,
      studentIds: ids,
      invitedBy: "GHL",
    });
    return { ...res, linked: ids.length, unmatched };
  },
});

// Revoke every open invite for an email (the emailed link stops personalizing).
export const revokeByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const rows = await ctx.db
      .query("parentInvites")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .collect();
    let revoked = 0;
    for (const inv of rows) {
      if (inv.status === "PENDING") {
        await ctx.db.patch(inv._id, { status: "CANCELLED" });
        revoked++;
      }
    }
    return { revoked };
  },
});

// Personalizes the sign-in page when a parent lands from an invite link.
export const byToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("parentInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.status === "CANCELLED") return null;
    const kidNames: string[] = [];
    for (const sid of invite.studentIds) {
      const s = await ctx.db.get(sid as Id<"students">);
      if (s) kidNames.push(s.fullName.split(" ")[0]);
    }
    return { fullName: invite.fullName, status: invite.status, kidNames };
  },
});

// Recent invites for the admin manager.
export const recent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("parentInvites")
      .withIndex("by_createdAt")
      .order("desc")
      .take(30);
  },
});

// Called from clerkBridge when a parent signs in — flips their invites.
export async function acceptInvitesForEmail(ctx: any, email: string) {
  const pending = await ctx.db
    .query("parentInvites")
    .withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase().trim()))
    .collect();
  for (const inv of pending) {
    if (inv.status === "PENDING") {
      await ctx.db.patch(inv._id, { status: "ACCEPTED", acceptedAt: Date.now() });
    }
  }
}
