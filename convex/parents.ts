import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { houseId } from "./schema";
import { studentDefaults, logActivity } from "./helpers";

// ── Password hashing (PBKDF2-SHA256 via Web Crypto, runs in actions) ─────────

const PBKDF2_ITERATIONS = 210_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type PublicParent = {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
};

// ── Internal plumbing ────────────────────────────────────────────────────────

export const byEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("parents")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
  },
});

export const createWithSession = internalMutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    passwordHash: v.string(),
    salt: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("parents")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) throw new Error("An account with this email already exists.");

    const parentId = await ctx.db.insert("parents", {
      email: args.email,
      fullName: args.fullName,
      phone: args.phone,
      passwordHash: args.passwordHash,
      salt: args.salt,
      createdAt: Date.now(),
    });
    await ctx.db.insert("parentSessions", {
      parentId,
      token: args.token,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return parentId;
  },
});

export const createSession = internalMutation({
  args: { parentId: v.id("parents"), token: v.string() },
  handler: async (ctx, { parentId, token }) => {
    await ctx.db.insert("parentSessions", {
      parentId,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  },
});

// ── Public auth API ──────────────────────────────────────────────────────────

export const signUp = action({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ token: string; parent: PublicParent }> => {
    const email = args.email.toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const existing = await ctx.runQuery(internal.parents.byEmailInternal, { email });
    if (existing) throw new Error("An account with this email already exists.");

    const salt = randomHex(16);
    const passwordHash = await hashPassword(args.password, salt);
    const token = randomHex(32);

    const parentId = await ctx.runMutation(internal.parents.createWithSession, {
      email,
      fullName: args.fullName.trim(),
      phone: args.phone?.trim(),
      passwordHash,
      salt,
      token,
    });

    return {
      token,
      parent: { id: parentId, email, fullName: args.fullName.trim(), phone: args.phone },
    };
  },
});

export const signIn = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ token: string; parent: PublicParent }> => {
    const email = args.email.toLowerCase().trim();
    const parent = await ctx.runQuery(internal.parents.byEmailInternal, { email });
    if (!parent) throw new Error("Invalid email or password.");

    const attempted = await hashPassword(args.password, parent.salt);
    if (!constantTimeEqual(attempted, parent.passwordHash)) {
      throw new Error("Invalid email or password.");
    }

    const token = randomHex(32);
    await ctx.runMutation(internal.parents.createSession, {
      parentId: parent._id,
      token,
    });

    return {
      token,
      parent: {
        id: parent._id,
        email: parent.email,
        fullName: parent.fullName,
        phone: parent.phone ?? undefined,
      },
    };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<PublicParent | null> => {
    const session = await ctx.db
      .query("parentSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    const parent = await ctx.db.get(session.parentId);
    if (!parent) return null;
    return {
      id: parent._id,
      email: parent.email,
      fullName: parent.fullName,
      phone: parent.phone ?? undefined,
    };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("parentSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

// ── Parent ↔ student links ───────────────────────────────────────────────────

export const linkedStudents = query({
  args: { parentId: v.id("parents") },
  handler: async (ctx, { parentId }) => {
    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .collect();
    const students = [];
    for (const link of links) {
      const student = await ctx.db.get(link.studentId);
      if (student) students.push(student);
    }
    return students;
  },
});

export const link = mutation({
  args: { parentId: v.id("parents"), studentId: v.id("students") },
  handler: async (ctx, { parentId, studentId }) => {
    const existing = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent_student", (q) =>
        q.eq("parentId", parentId).eq("studentId", studentId)
      )
      .unique();
    if (existing) return;
    await ctx.db.insert("parentStudentLinks", {
      parentId,
      studentId,
      createdAt: Date.now(),
    });
  },
});

export const unlink = mutation({
  args: { parentId: v.id("parents"), studentId: v.id("students") },
  handler: async (ctx, { parentId, studentId }) => {
    const existing = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent_student", (q) =>
        q.eq("parentId", parentId).eq("studentId", studentId)
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// Parent enrolls a new athlete and links them in one transaction
export const enrollStudent = mutation({
  args: {
    parentId: v.id("parents"),
    fullName: v.string(),
    gamerTag: v.optional(v.string()),
    houseId: houseId,
    gender: v.union(v.literal("Male"), v.literal("Female")),
    avatarUrl: v.optional(v.string()),
    isPresent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const defaults = studentDefaults(args.fullName);
    const studentId = await ctx.db.insert("students", {
      ...defaults,
      fullName: args.fullName,
      houseId: args.houseId,
      gender: args.gender,
      gamerTag: args.gamerTag || "",
      displayPreference: "FULL_NAME",
      avatarUrl: args.avatarUrl || defaults.avatarUrl,
      isPresent: args.isPresent ?? false,
      friendIds: [],
      totalXp: 0,
    });
    await ctx.db.insert("parentStudentLinks", {
      parentId: args.parentId,
      studentId,
      createdAt: Date.now(),
    });
    return await ctx.db.get(studentId);
  },
});

// Admin view: all parents with their linked athletes (ParentManager)
// Delete a parent account outright (admin): links, sessions, invites, and the
// message thread go with it. Signing in again with the same email would
// self-serve a fresh empty account — that's by design.
export const removeAccount = mutation({
  args: { parentId: v.id("parents"), adminName: v.string() },
  handler: async (ctx, { parentId, adminName }) => {
    const parent = await ctx.db.get(parentId);
    if (!parent) return { ok: true };

    const links = await ctx.db
      .query("parentStudentLinks")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

    const sessions = await ctx.db
      .query("parentSessions")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    const invites = await ctx.db
      .query("parentInvites")
      .withIndex("by_email", (q) => q.eq("email", parent.email))
      .collect();
    for (const i of invites) await ctx.db.delete(i._id);

    const convos = await ctx.db
      .query("conversations")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .collect();
    for (const c of convos) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .collect();
      for (const m of msgs) await ctx.db.delete(m._id);
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(parentId);
    await logActivity(ctx, {
      type: "ACCOUNT_DELETE",
      message: `Parent account removed: ${parent.fullName} (${parent.email})`,
      adminName,
    });
    return { ok: true };
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const parents = await ctx.db.query("parents").collect();
    const results = [];
    for (const p of parents) {
      const links = await ctx.db
        .query("parentStudentLinks")
        .withIndex("by_parent", (q) => q.eq("parentId", p._id))
        .collect();
      const linkedStudents = [];
      for (const link of links) {
        const student = await ctx.db.get(link.studentId);
        if (student) linkedStudents.push(student);
      }
      results.push({
        id: p._id,
        email: p.email,
        fullName: p.fullName,
        phone: p.phone ?? "—",
        createdAt: new Date(p.createdAt).toISOString(),
        linkedStudents,
      });
    }
    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});
