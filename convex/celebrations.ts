import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";

// Queued congrats: big moments (Volt level ups, house reveals) push a
// notification AND queue a celebration here, so the next time the app opens
// the kid or family gets the full congrats pop-up.

export const queueCelebration = async (
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    kind: "LEVEL_UP" | "HOUSE_REVEAL" | "AWARD";
    title: string;
    message: string;
    icon?: string;
  }
) => {
  await ctx.db.insert("pendingCelebrations", {
    studentId: args.studentId,
    kind: args.kind,
    title: args.title,
    message: args.message,
    icon: args.icon,
    createdAt: Date.now(),
  });
};

const unseenRows = async (ctx: QueryCtx, studentId: Id<"students">) => {
  const rows = await ctx.db
    .query("pendingCelebrations")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  return rows.filter((r) => !r.seenAt);
};

const shape = (r: Doc<"pendingCelebrations">) => ({
  id: r._id,
  studentId: r.studentId,
  kind: r.kind,
  title: r.title,
  message: r.message,
  icon: r.icon ?? null,
  createdAt: r.createdAt,
});

export const unseenFor = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const rows = await unseenRows(ctx, studentId);
    return rows.sort((a, b) => a.createdAt - b.createdAt).map(shape);
  },
});

// Family view: unseen celebrations across every linked kid at once.
export const unseenForMany = query({
  args: { studentIds: v.array(v.id("students")) },
  handler: async (ctx, { studentIds }) => {
    const all: Doc<"pendingCelebrations">[] = [];
    for (const studentId of studentIds) {
      all.push(...(await unseenRows(ctx, studentId)));
    }
    return all.sort((a, b) => a.createdAt - b.createdAt).map(shape);
  },
});

export const markSeen = mutation({
  args: { ids: v.array(v.id("pendingCelebrations")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row && !row.seenAt) await ctx.db.patch(id, { seenAt: Date.now() });
    }
    return { ok: true };
  },
});
