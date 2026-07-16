import { query } from "./_generated/server";
import { v } from "convex/values";

// Unified attendance & scan log: every check-in (QR / NFC / manual, from the
// checkIns ledger) plus every NFC game/award tap (nfcScans), newest first.
// Powers the admin "Scan Log" page and its CSV export.

export interface LogEntry {
  ts: number;
  type: string; // CHECKIN_QR | CHECKIN_NFC | CHECKIN_MANUAL | CHECKOUT | NFC_GAME | NFC_AWARD
  studentName: string;
  houseId?: string | null;
  detail: string;
  actor: string;
}

export const list = query({
  args: { fromMs: v.number(), toMs: v.number() },
  handler: async (ctx, { fromMs, toMs }) => {
    const entries: LogEntry[] = [];

    // Check-ins (durable attendance ledger; date-scoped rows carry timestamps)
    const checkIns = await ctx.db.query("checkIns").collect();
    for (const ci of checkIns) {
      if (ci.checkedInAt >= fromMs && ci.checkedInAt <= toMs) {
        const student = await ctx.db.get(ci.studentId);
        let actor = ci.byAdminName ?? "";
        if (!actor && ci.byParentId) {
          const parent = await ctx.db.get(ci.byParentId);
          actor = parent ? `${parent.fullName} (parent)` : "parent";
        }
        entries.push({
          ts: ci.checkedInAt,
          type: `CHECKIN_${ci.method}`,
          studentName: student?.fullName ?? "(removed)",
          houseId: student?.houseId ?? null,
          detail: `Checked in · ${ci.method}`,
          actor: actor || "—",
        });
      }
      if (ci.checkedOutAt && ci.checkedOutAt >= fromMs && ci.checkedOutAt <= toMs) {
        const student = await ctx.db.get(ci.studentId);
        entries.push({
          ts: ci.checkedOutAt,
          type: "CHECKOUT",
          studentName: student?.fullName ?? "(removed)",
          houseId: student?.houseId ?? null,
          detail: "Checked out",
          actor: ci.byAdminName ?? "—",
        });
      }
    }

    // NFC game/award taps (check-in taps already covered by checkIns above)
    const scans = await ctx.db
      .query("nfcScans")
      .withIndex("by_ts", (q) => q.gte("ts", fromMs).lte("ts", toMs))
      .collect();
    for (const s of scans) {
      if (s.kind === "CHECKIN") continue; // avoid double rows
      entries.push({
        ts: s.ts,
        type: s.kind === "GAME" ? "NFC_GAME" : "NFC_AWARD",
        studentName: s.studentName ?? `Unknown tag …${s.tagUid.slice(-6)}`,
        houseId: s.houseId ?? null,
        detail:
          s.kind === "GAME"
            ? `Timing tap${s.splitMs ? ` · ${(s.splitMs / 1000).toFixed(1)}s split` : ""}${s.gameTitle ? ` · ${s.gameTitle}` : ""}`
            : `+${s.amount} pts${s.gameTitle ? ` · ${s.gameTitle}` : ""}`,
        actor: s.actor,
      });
    }

    entries.sort((a, b) => b.ts - a.ts);
    return entries.slice(0, 500);
  },
});
