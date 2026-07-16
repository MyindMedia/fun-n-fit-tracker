import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { houseId } from "./schema";
import { getRankList, logActivity, studentDefaults } from "./helpers";

// Bulk roster import (Supabase recovery / spreadsheet onboarding).
// Idempotent: skips any student whose fullName already exists (case-insensitive),
// so it's safe to re-run. Points are set directly and rank is derived from the
// rank table, matching what applyPoints would have produced.
export const importStudents = mutation({
  args: {
    students: v.array(
      v.object({
        fullName: v.string(),
        houseId: v.optional(houseId),
        gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
        points: v.optional(v.number()),
        totalXp: v.optional(v.number()),
        gamerTag: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
        bio: v.optional(v.string()),
        badges: v.optional(v.array(v.string())),
        inventory: v.optional(v.array(v.string())),
        isPresent: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, { students }) => {
    const existing = await ctx.db.query("students").collect();
    const existingNames = new Set(existing.map((s) => s.fullName.trim().toLowerCase()));
    const ranks = await getRankList(ctx);
    const houses = ["UNITY", "SAGE", "SPARK", "VALOR"] as const;

    let imported = 0;
    const skipped: string[] = [];

    for (const [i, row] of students.entries()) {
      const name = row.fullName.trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) {
        skipped.push(name);
        continue;
      }
      const points = Math.max(0, row.points ?? 0);
      const qualified = ranks.filter((r) => points >= r.threshold);
      const rank = qualified[qualified.length - 1] ?? ranks[0];
      const defaults = studentDefaults(name);
      await ctx.db.insert("students", {
        ...defaults,
        fullName: name,
        houseId: row.houseId ?? houses[i % houses.length], // round-robin when unassigned
        gender: row.gender ?? "Male",
        points,
        rankId: rank.id,
        totalXp: row.totalXp ?? 0,
        gamerTag: row.gamerTag ?? "",
        displayPreference: "FULL_NAME",
        avatarUrl: row.avatarUrl || defaults.avatarUrl,
        bio: row.bio ?? undefined,
        badges: row.badges ?? [],
        inventory: row.inventory ?? [],
        isPresent: row.isPresent ?? false,
        friendIds: [],
      });
      existingNames.add(name.toLowerCase());
      imported++;
    }

    if (imported > 0) {
      await logActivity(ctx, {
        type: "ENROLL",
        message: `Roster import: ${imported} student${imported === 1 ? "" : "s"} added`,
        adminName: "Migration",
      });
    }
    return { imported, skipped };
  },
});
