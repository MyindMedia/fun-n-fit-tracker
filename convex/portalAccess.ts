import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivity } from "./helpers";

// Parent-granted student self-login. The kid picks their name on /login and
// enters the 4-digit PIN their parent set. `status` never exposes the PIN;
// verification happens server-side only.

const rowFor = async (ctx: { db: any }, studentId: string) =>
  await ctx.db
    .query("portalAccess")
    .withIndex("by_student", (q: any) => q.eq("studentId", studentId))
    .unique();

// Public: is self-login enabled for this kid? (no PIN in the payload)
export const status = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const row = await rowFor(ctx, studentId);
    return { enabled: row?.enabled ?? false };
  },
});

// Parent detail view: full settings including the PIN (to tell the kid).
export const settings = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const row = await rowFor(ctx, studentId);
    return row ? { enabled: row.enabled, pin: row.pin } : { enabled: false, pin: "" };
  },
});

export const setAccess = mutation({
  args: {
    studentId: v.id("students"),
    enabled: v.boolean(),
    pin: v.optional(v.string()),
  },
  handler: async (ctx, { studentId, enabled, pin }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    if (enabled) {
      const effectivePin = pin ?? (await rowFor(ctx, studentId))?.pin ?? "";
      if (!/^\d{4}$/.test(effectivePin)) {
        throw new Error("Set a 4-digit PIN to enable student login");
      }
    }
    if (pin !== undefined && pin !== "" && !/^\d{4}$/.test(pin)) {
      throw new Error("PIN must be exactly 4 digits");
    }

    const row = await rowFor(ctx, studentId);
    if (row) {
      await ctx.db.patch(row._id, {
        enabled,
        ...(pin !== undefined ? { pin } : {}),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("portalAccess", {
        studentId,
        enabled,
        pin: pin ?? "",
        updatedAt: Date.now(),
      });
    }
  },
});

export const verify = mutation({
  args: { studentId: v.id("students"), pin: v.string() },
  handler: async (ctx, { studentId, pin }) => {
    const row = await rowFor(ctx, studentId);
    if (!row?.enabled) return { ok: false, reason: "DISABLED" as const };
    if (row.pin !== pin) return { ok: false, reason: "WRONG_PIN" as const };
    const student = await ctx.db.get(studentId);
    if (student) {
      await logActivity(ctx, {
        type: "PORTAL_LOGIN",
        message: `${student.fullName} signed in to the student portal`,
        studentId,
        studentName: student.fullName,
      });
    }
    return { ok: true as const, reason: null };
  },
});
