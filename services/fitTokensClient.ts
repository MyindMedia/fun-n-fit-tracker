// FitTokens service: packs, purchase intents, admin queue, balances, and the
// vanity-only Avatar Studio spend path. Same singleton-service pattern as
// services/gameCenter.ts; parent-scoped calls read the session token from
// parentAuth automatically. Backend: convex/fitTokens.ts.
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { parentAuth } from "./parentAuth";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

const requireToken = (): string => {
  const token = parentAuth.sessionToken;
  if (!token) throw new Error("Please sign in to your parent account first");
  return token;
};

export type PurchaseStatus = "PENDING" | "CREDITED" | "CANCELLED";

export interface FitTokenPack {
  id: string;
  key: string;
  name: string;
  tokens: number;
  priceLabel: string;
  paymentUrl: string | null;
  sort: number;
  active: boolean;
}

export interface FitTokenPurchase {
  id: string;
  reference: string;
  packKey: string;
  packName: string;
  priceLabel: string;
  paymentUrl: string | null;
  tokens: number;
  status: PurchaseStatus;
  studentId: string;
  studentName: string;
  createdAt: number;
  resolvedAt: number | null;
  creditedBy: string | null;
}

export interface StartPurchaseResult {
  purchaseId: string;
  reference: string;
  tokens: number;
  packKey: string;
  packName: string;
  priceLabel: string;
  paymentUrl: string | null;
  studentName: string;
}

export interface PendingPurchaseRow {
  id: string;
  reference: string;
  packKey: string;
  packName: string;
  priceLabel: string;
  tokens: number;
  parentName: string;
  parentEmail: string;
  studentId: string;
  studentName: string;
  createdAt: number;
}

export interface TokenBalanceRow {
  studentId: string;
  fullName: string;
  gamerTag: string | null;
  fitTokens: number;
}

class FitTokensService {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  // ── Packs ──────────────────────────────────────────────────────────────────

  /** Active packs, sorted for display (parent portal sheet). */
  public async packs(): Promise<FitTokenPack[]> {
    return (await this.client.query(api.fitTokens.packs, {})) as FitTokenPack[];
  }

  /** Every pack, active or not (admin Token Center editor). */
  public async allPacks(): Promise<FitTokenPack[]> {
    return (await this.client.query(api.fitTokens.allPacks, {})) as FitTokenPack[];
  }

  public async upsertPack(pack: {
    key: string;
    name: string;
    tokens: number;
    priceLabel: string;
    paymentUrl?: string | null;
    sort?: number;
    active: boolean;
  }): Promise<{ created: boolean }> {
    return await this.client.mutation(api.fitTokens.upsertPack, pack);
  }

  public async removePack(key: string): Promise<{ removed: boolean }> {
    return await this.client.mutation(api.fitTokens.removePack, { key });
  }

  // ── Purchase intents (parent portal) ───────────────────────────────────────

  public async startPurchase(
    studentId: string,
    packKey: string
  ): Promise<StartPurchaseResult> {
    return (await this.client.mutation(api.fitTokens.startPurchase, {
      sessionToken: requireToken(),
      studentId: studentId as Id<"students">,
      packKey,
    })) as StartPurchaseResult;
  }

  public async cancelPurchase(purchaseId: string): Promise<void> {
    await this.client.mutation(api.fitTokens.cancelPurchase, {
      sessionToken: requireToken(),
      purchaseId: purchaseId as Id<"fitTokenPurchases">,
    });
  }

  public async myPurchases(): Promise<FitTokenPurchase[]> {
    return (await this.client.query(api.fitTokens.myPurchases, {
      sessionToken: requireToken(),
    })) as FitTokenPurchase[];
  }

  /** Live view of this parent's purchases (status chips flip when the desk or
   *  webhook credits a code). Returns unsubscribe. */
  public subscribeMyPurchases(cb: (rows: FitTokenPurchase[]) => void): () => void {
    return this.client.onUpdate(
      api.fitTokens.myPurchases,
      { sessionToken: requireToken() },
      (rows) => cb(rows as FitTokenPurchase[])
    );
  }

  // ── Admin: pending queue + crediting ───────────────────────────────────────

  public async pendingPurchases(): Promise<PendingPurchaseRow[]> {
    return (await this.client.query(api.fitTokens.pendingPurchases, {})) as PendingPurchaseRow[];
  }

  /** Live pending-purchase queue for the Token Center. Returns unsubscribe. */
  public subscribePendingPurchases(cb: (rows: PendingPurchaseRow[]) => void): () => void {
    return this.client.onUpdate(api.fitTokens.pendingPurchases, {}, (rows) =>
      cb(rows as PendingPurchaseRow[])
    );
  }

  public async adminCredit(
    purchaseId: string,
    adminName: string
  ): Promise<{ ok: boolean; already: boolean }> {
    return (await this.client.mutation(api.fitTokens.adminCredit, {
      purchaseId: purchaseId as Id<"fitTokenPurchases">,
      adminName,
    })) as { ok: boolean; already: boolean };
  }

  public async adminCancel(purchaseId: string, adminName: string): Promise<void> {
    await this.client.mutation(api.fitTokens.adminCancel, {
      purchaseId: purchaseId as Id<"fitTokenPurchases">,
      adminName,
    });
  }

  // ── Admin: balances + manual adjust ────────────────────────────────────────

  public async balances(): Promise<TokenBalanceRow[]> {
    return (await this.client.query(api.fitTokens.balances, {})) as TokenBalanceRow[];
  }

  public async adjust(
    studentId: string,
    delta: number,
    reason: string,
    adminName: string
  ): Promise<{ balance: number; applied: number }> {
    return await this.client.mutation(api.fitTokens.adjust, {
      studentId: studentId as Id<"students">,
      delta,
      reason,
      adminName,
    });
  }

  // ── Spending: vanity only (Avatar Studio) ──────────────────────────────────

  public async buyAvatarItem(
    studentId: string,
    itemKey: string
  ): Promise<{ balance: number; itemKey: string }> {
    return await this.client.mutation(api.fitTokens.buyAvatarItem, {
      studentId: studentId as Id<"students">,
      itemKey,
    });
  }
}

export const fitTokensClient = new FitTokensService();
