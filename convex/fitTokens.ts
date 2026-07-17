// FitTokens (ECONOMY_SPEC.md section 1): parent-paid cosmetic currency.
// Real money only ever moves on external hosted checkout pages; this module
// stores packs, purchase intents, the audited ledger, and vanity-only spending.
// Balance patches on students.fitTokens always happen in the same mutation as
// the fitTokenLedger insert.
import { internalMutation, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { logActivity, randomToken, requireParent, requireParentLink } from "./helpers";
import { avatarItem } from "../avatarCatalog";

const mapPack = (p: Doc<"fitTokenPacks">) => ({
  id: p._id,
  key: p.key,
  name: p.name,
  tokens: p.tokens,
  priceLabel: p.priceLabel,
  paymentUrl: p.paymentUrl ?? null,
  sort: p.sort,
  active: p.active,
});

// ── Packs ────────────────────────────────────────────────────────────────────

// Active packs for the parent portal sheet, sorted for display.
export const packs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("fitTokenPacks")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return rows.sort((a, b) => a.sort - b.sort).map(mapPack);
  },
});

// Every pack, active or not, for the admin Token Center editor.
export const allPacks = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("fitTokenPacks").collect();
    return rows.sort((a, b) => a.sort - b.sort).map(mapPack);
  },
});

export const upsertPack = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    tokens: v.number(),
    priceLabel: v.string(),
    paymentUrl: v.optional(v.union(v.string(), v.null())),
    sort: v.optional(v.number()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const key = args.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) throw new Error("Pack key is required");
    const tokens = Math.round(args.tokens);
    if (!Number.isFinite(tokens) || tokens <= 0) {
      throw new Error("Tokens must be a positive number");
    }
    const existing = await ctx.db
      .query("fitTokenPacks")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name.trim() || existing.name,
        tokens,
        priceLabel: args.priceLabel.trim(),
        // undefined = leave the configured checkout link alone
        paymentUrl:
          args.paymentUrl === undefined ? existing.paymentUrl ?? "" : args.paymentUrl ?? "",
        sort: args.sort ?? existing.sort,
        active: args.active,
      });
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("fitTokenPacks", {
      key,
      name: args.name.trim() || key,
      tokens,
      priceLabel: args.priceLabel.trim(),
      paymentUrl: args.paymentUrl ?? "",
      sort: args.sort ?? 99,
      active: args.active,
      createdAt: Date.now(),
    });
    return { id, created: true };
  },
});

export const removePack = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("fitTokenPacks")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!existing) return { removed: false };
    await ctx.db.delete(existing._id);
    return { removed: true };
  },
});

// Idempotent seed: inserts the default packs when missing; when a pack already
// exists only the display fields refresh, so a configured paymentUrl or an
// admin's active toggle never gets clobbered by a reseed.
export const seedPacks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { key: "starter", name: "Starter Pack", tokens: 50, priceLabel: "$4.99", sort: 1 },
      { key: "player", name: "Player Pack", tokens: 120, priceLabel: "$9.99", sort: 2 },
      { key: "pro", name: "Pro Pack", tokens: 300, priceLabel: "$19.99", sort: 3 },
    ];
    let created = 0;
    for (const def of defaults) {
      const existing = await ctx.db
        .query("fitTokenPacks")
        .withIndex("by_key", (q) => q.eq("key", def.key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: def.name,
          tokens: def.tokens,
          priceLabel: def.priceLabel,
          sort: def.sort,
        });
      } else {
        await ctx.db.insert("fitTokenPacks", {
          ...def,
          paymentUrl: "",
          active: true,
          createdAt: Date.now(),
        });
        created++;
      }
    }
    return { created, total: defaults.length };
  },
});

// ── Purchase intents (parent portal) ─────────────────────────────────────────

export const startPurchase = mutation({
  args: {
    sessionToken: v.string(),
    studentId: v.id("students"),
    packKey: v.string(),
  },
  handler: async (ctx, args) => {
    const parent = await requireParent(ctx, args.sessionToken);
    await requireParentLink(ctx, parent._id, args.studentId);
    const pack = await ctx.db
      .query("fitTokenPacks")
      .withIndex("by_key", (q) => q.eq("key", args.packKey))
      .unique();
    if (!pack || !pack.active) {
      throw new Error("That FitTokens pack is not available right now");
    }
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // FT- + 6 uppercase hex chars; retry on the vanishingly rare collision.
    let reference = "";
    for (let i = 0; i < 5 && !reference; i++) {
      const candidate = `FT-${randomToken(3).toUpperCase()}`;
      const clash = await ctx.db
        .query("fitTokenPurchases")
        .withIndex("by_reference", (q) => q.eq("reference", candidate))
        .unique();
      if (!clash) reference = candidate;
    }
    if (!reference) throw new Error("Could not generate a reference code, please try again");

    const purchaseId = await ctx.db.insert("fitTokenPurchases", {
      parentId: parent._id,
      studentId: args.studentId,
      packKey: pack.key,
      tokens: pack.tokens,
      reference,
      status: "PENDING",
      createdAt: Date.now(),
    });
    return {
      purchaseId,
      reference,
      tokens: pack.tokens,
      packKey: pack.key,
      packName: pack.name,
      priceLabel: pack.priceLabel,
      paymentUrl: pack.paymentUrl ?? null,
      studentName: student.fullName,
    };
  },
});

export const cancelPurchase = mutation({
  args: { sessionToken: v.string(), purchaseId: v.id("fitTokenPurchases") },
  handler: async (ctx, { sessionToken, purchaseId }) => {
    const parent = await requireParent(ctx, sessionToken);
    const purchase = await ctx.db.get(purchaseId);
    if (!purchase || purchase.parentId !== parent._id) {
      throw new Error("Purchase not found");
    }
    if (purchase.status !== "PENDING") {
      throw new Error("Only pending purchases can be cancelled");
    }
    await ctx.db.patch(purchaseId, { status: "CANCELLED", resolvedAt: Date.now() });
    return { ok: true };
  },
});

export const myPurchases = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const parent = await requireParent(ctx, sessionToken);
    const rows = await ctx.db
      .query("fitTokenPurchases")
      .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
      .order("desc")
      .take(25);
    const out = [];
    for (const p of rows) {
      const student = await ctx.db.get(p.studentId);
      const pack = await ctx.db
        .query("fitTokenPacks")
        .withIndex("by_key", (q) => q.eq("key", p.packKey))
        .unique();
      out.push({
        id: p._id,
        reference: p.reference,
        packKey: p.packKey,
        packName: pack?.name ?? p.packKey,
        priceLabel: pack?.priceLabel ?? "",
        paymentUrl: pack?.paymentUrl ?? null,
        tokens: p.tokens,
        status: p.status,
        studentId: p.studentId,
        studentName: student?.fullName ?? "Athlete",
        createdAt: p.createdAt,
        resolvedAt: p.resolvedAt ?? null,
        creditedBy: p.creditedBy ?? null,
      });
    }
    return out;
  },
});

// ── Crediting (idempotent, shared by webhook + admin) ───────────────────────

// The one place tokens land on a student from a purchase: balance patch,
// status flip, ledger row, and activity feed all in the same mutation.
async function creditPurchase(
  ctx: MutationCtx,
  purchase: Doc<"fitTokenPurchases">,
  byName: string
) {
  const student = await ctx.db.get(purchase.studentId);
  if (!student) throw new Error("Student not found");
  const pack = await ctx.db
    .query("fitTokenPacks")
    .withIndex("by_key", (q) => q.eq("key", purchase.packKey))
    .unique();
  const balance = (student.fitTokens ?? 0) + purchase.tokens;
  await ctx.db.patch(purchase.studentId, { fitTokens: balance });
  await ctx.db.patch(purchase._id, {
    status: "CREDITED",
    creditedBy: byName,
    resolvedAt: Date.now(),
  });
  await ctx.db.insert("fitTokenLedger", {
    studentId: purchase.studentId,
    amount: purchase.tokens,
    kind: "PURCHASE",
    description: `${pack?.name ?? purchase.packKey} pack (${purchase.reference})`,
    byName,
    createdAt: Date.now(),
  });
  await logActivity(ctx, {
    type: "TOKENS",
    message: `FitTokens added: +${purchase.tokens} for ${student.fullName}`,
    adminName: byName,
    studentId: purchase.studentId,
    studentName: student.fullName,
    amount: purchase.tokens,
    avatarUrl: student.avatarUrl,
  });
  return { balance, tokens: purchase.tokens, studentName: student.fullName };
}

export const adminCredit = mutation({
  args: { purchaseId: v.id("fitTokenPurchases"), adminName: v.string() },
  handler: async (ctx, { purchaseId, adminName }) => {
    const purchase = await ctx.db.get(purchaseId);
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status === "CREDITED") return { ok: true, already: true };
    if (purchase.status === "CANCELLED") {
      throw new Error("This purchase was cancelled, ask the parent to start a new one");
    }
    const res = await creditPurchase(ctx, purchase, adminName || "Coach");
    return { ok: true, already: false, ...res };
  },
});

export const adminCancel = mutation({
  args: { purchaseId: v.id("fitTokenPurchases"), adminName: v.string() },
  handler: async (ctx, { purchaseId, adminName }) => {
    const purchase = await ctx.db.get(purchaseId);
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.status !== "PENDING") {
      throw new Error("Only pending purchases can be cancelled");
    }
    await ctx.db.patch(purchaseId, {
      status: "CANCELLED",
      creditedBy: adminName || "Coach",
      resolvedAt: Date.now(),
    });
    return { ok: true };
  },
});

type WebhookCreditResult = {
  ok: boolean;
  already?: boolean;
  credited?: boolean;
  reference?: string;
  tokens?: number;
  studentName?: string;
  reason?: string;
};

// Called by http.ts POST /fittoken-purchase after the secret header checks out.
// Match by reference code, or by parent email + packKey (newest PENDING wins).
export const creditFromWebhook = internalMutation({
  args: {
    reference: v.optional(v.string()),
    email: v.optional(v.string()),
    packKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<WebhookCreditResult> => {
    let purchase: Doc<"fitTokenPurchases"> | null = null;

    if (args.reference) {
      const ref = args.reference.trim().toUpperCase();
      purchase = await ctx.db
        .query("fitTokenPurchases")
        .withIndex("by_reference", (q) => q.eq("reference", ref))
        .unique();
      if (!purchase) {
        return { ok: false, reason: `no purchase found for reference ${ref}` };
      }
    } else if (args.email && args.packKey) {
      const email = args.email.trim().toLowerCase();
      const parent = await ctx.db
        .query("parents")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!parent) {
        return { ok: false, reason: `no parent account found for ${email}` };
      }
      const rows = await ctx.db
        .query("fitTokenPurchases")
        .withIndex("by_parent", (q) => q.eq("parentId", parent._id))
        .order("desc")
        .collect();
      purchase =
        rows.find((r) => r.status === "PENDING" && r.packKey === args.packKey) ?? null;
      if (!purchase) {
        return {
          ok: false,
          reason: `no pending ${args.packKey} purchase for ${email}`,
        };
      }
    } else {
      return { ok: false, reason: "send { reference } or { email, packKey }" };
    }

    if (purchase.status === "CREDITED") {
      return { ok: true, already: true, reference: purchase.reference };
    }
    if (purchase.status === "CANCELLED") {
      return { ok: false, reason: `purchase ${purchase.reference} was cancelled` };
    }
    const res = await creditPurchase(ctx, purchase, "WEBHOOK");
    return {
      ok: true,
      already: false,
      credited: true,
      reference: purchase.reference,
      tokens: res.tokens,
      studentName: res.studentName,
    };
  },
});

// ── Admin queue + balances + manual adjust ───────────────────────────────────

export const pendingPurchases = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("fitTokenPurchases")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .order("asc")
      .collect();
    const out = [];
    for (const p of rows) {
      const parent = await ctx.db.get(p.parentId);
      const student = await ctx.db.get(p.studentId);
      const pack = await ctx.db
        .query("fitTokenPacks")
        .withIndex("by_key", (q) => q.eq("key", p.packKey))
        .unique();
      out.push({
        id: p._id,
        reference: p.reference,
        packKey: p.packKey,
        packName: pack?.name ?? p.packKey,
        priceLabel: pack?.priceLabel ?? "",
        tokens: p.tokens,
        parentName: parent?.fullName ?? "Parent",
        parentEmail: parent?.email ?? "",
        studentId: p.studentId,
        studentName: student?.fullName ?? "Athlete",
        createdAt: p.createdAt,
      });
    }
    return out;
  },
});

// Per-student balances for the Token Center. Returns everyone so staff can
// grant tokens to a kid at zero; the UI handles search and sorting display.
export const balances = query({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    return students
      .map((s) => ({
        studentId: s._id,
        fullName: s.fullName,
        gamerTag: s.gamerTag ?? null,
        fitTokens: s.fitTokens ?? 0,
      }))
      .sort((a, b) => b.fitTokens - a.fitTokens || a.fullName.localeCompare(b.fullName));
  },
});

// Manual grant or correction. Balance never goes below zero; the ledger row
// records what was actually applied after the clamp.
export const adjust = mutation({
  args: {
    studentId: v.id("students"),
    delta: v.number(),
    reason: v.string(),
    adminName: v.string(),
  },
  handler: async (ctx, { studentId, delta, reason, adminName }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const rounded = Math.round(delta);
    if (!rounded) throw new Error("Enter a non-zero amount");
    const current = student.fitTokens ?? 0;
    const balance = Math.max(0, current + rounded);
    const applied = balance - current;
    if (applied === 0) return { balance, applied: 0 };
    const note = reason.trim() || "Manual adjustment";
    await ctx.db.patch(studentId, { fitTokens: balance });
    await ctx.db.insert("fitTokenLedger", {
      studentId,
      amount: applied,
      kind: "ADJUST",
      description: note,
      byName: adminName || "Coach",
      createdAt: Date.now(),
    });
    await logActivity(ctx, {
      type: "TOKENS",
      message: `${applied > 0 ? "+" : ""}${applied} FitTokens: ${note}`,
      adminName: adminName || "Coach",
      studentId,
      studentName: student.fullName,
      amount: applied,
    });
    return { balance, applied };
  },
});

// ── Spending: vanity only (Avatar Studio) ────────────────────────────────────

// FitTokens buy cosmetics and nothing else. Item must carry a tokenPrice in
// avatarCatalog.ts; gear, boosts, and points have no token path by design.
export const buyAvatarItem = mutation({
  args: { studentId: v.id("students"), itemKey: v.string() },
  handler: async (ctx, { studentId, itemKey }) => {
    const item = avatarItem(itemKey);
    if (!item) throw new Error("Unknown avatar item");
    if (item.isDefault || !item.tokenPrice) {
      throw new Error(`${item.name} is not available for FitTokens`);
    }
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const owned = await ctx.db
      .query("studentWearables")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    if (owned.some((w) => w.wearableId === itemKey)) {
      throw new Error("You already own this item");
    }
    const balance = student.fitTokens ?? 0;
    if (balance < item.tokenPrice) {
      throw new Error(
        `${item.name} costs ${item.tokenPrice} FitTokens and you have ${balance}`
      );
    }

    const newBalance = balance - item.tokenPrice;
    await ctx.db.patch(studentId, { fitTokens: newBalance });
    await ctx.db.insert("studentWearables", {
      studentId,
      wearableId: itemKey,
      acquiredAt: Date.now(),
      upgradeLevel: 0,
    });
    await ctx.db.insert("fitTokenLedger", {
      studentId,
      amount: -item.tokenPrice,
      kind: "SPEND",
      description: `Avatar item: ${item.name}`,
      byName: student.fullName,
      createdAt: Date.now(),
    });

    // Instant gratification: equip the new item, same as a crate pull.
    const look = student.avatarLook ?? {};
    const slotKey =
      item.slot === "HAIRSTYLE" ? "hair" : item.slot === "TOP" ? "top" : "acc";
    await ctx.db.patch(studentId, {
      avatarLook: { ...look, [slotKey]: item.key },
    });

    await logActivity(ctx, {
      type: "TOKENS",
      message: `${student.fullName} unlocked ${item.name} with FitTokens`,
      studentId,
      studentName: student.fullName,
      amount: -item.tokenPrice,
      avatarUrl: student.avatarUrl,
    });

    return { balance: newBalance, itemKey };
  },
});
