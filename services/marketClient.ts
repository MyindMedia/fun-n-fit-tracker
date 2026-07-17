// Jackpot + Marketplace service: prize wheel spins, donated-prize shelf,
// claim-code orders and the admin pickup queue. Same singleton-service pattern
// as services/gameCenter.ts (own ConvexClient, mapId, subscribe* returning the
// unsubscribe function).
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

const mapId = <T extends { _id: string }>(doc: T): Omit<T, "_id"> & { id: string } => {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};

// ── Types ────────────────────────────────────────────────────────────────────

export type JackpotPrizeKind = "POINTS" | "TOKENS" | "AVATAR_ITEM";

export interface JackpotPrize {
  id: string;
  key: string;
  label: string;
  kind: JackpotPrizeKind;
  value: string; // POINTS/TOKENS: amount; AVATAR_ITEM: rarity
  weight: number;
  active: boolean;
  createdAt: number;
}

export interface JackpotSpinResult {
  prizeKey: string;
  kind: JackpotPrizeKind;
  label: string; // resolved ("Volt Hawk", not "Mystery Item")
  resolvedItemKey?: string;
}

export interface JackpotSpinRow {
  id: string;
  studentId: string;
  prizeKey: string;
  label: string;
  byAdmin: string;
  createdAt: number;
  studentName: string;
  gamerTag?: string | null;
  avatarUrl?: string | null;
}

export interface MarketItem {
  id: string;
  name: string;
  description: string;
  icon: string; // Ic icon key or short label
  imageUrl?: string | null;
  pointCost: number;
  qtyAvailable: number;
  donatedBy?: string | null;
  active: boolean;
  createdAt: number;
}

export type MarketOrderStatus = "PENDING" | "FULFILLED" | "CANCELLED";

export interface MarketOrder {
  id: string;
  studentId: string;
  itemId: string;
  itemName: string;
  cost: number;
  claimCode: string;
  status: MarketOrderStatus;
  requestedVia: "STUDENT" | "PARENT";
  confirmedBy?: string | null;
  createdAt: number;
  resolvedAt?: number | null;
}

export interface MarketQueueRow {
  order: MarketOrder;
  studentName: string;
  gamerTag?: string | null;
  avatarUrl?: string | null;
}

export interface MarketQueue {
  pending: MarketQueueRow[];
  resolved: MarketQueueRow[];
}

export interface UpsertMarketItemInput {
  id?: string;
  name: string;
  description: string;
  icon: string;
  imageUrl?: string | null;
  pointCost: number;
  qtyAvailable: number;
  donatedBy?: string | null;
  active: boolean;
}

// Device-local calendar date, e.g. "2026-07-16"
const localDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// ── Service ──────────────────────────────────────────────────────────────────

class MarketClientService {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  // ── Jackpot: prize pool ────────────────────────────────────────────────────

  /** All prizes, for the admin pool editor. */
  public async listPrizes(): Promise<JackpotPrize[]> {
    const rows = (await this.client.query(api.jackpot.prizes, {})) as any[];
    return rows.map(mapId) as JackpotPrize[];
  }

  /** Active prizes only: the wheel segments. */
  public async listActivePrizes(): Promise<JackpotPrize[]> {
    const rows = (await this.client.query(api.jackpot.activePrizes, {})) as any[];
    return rows.map(mapId) as JackpotPrize[];
  }

  public subscribeActivePrizes(cb: (prizes: JackpotPrize[]) => void): () => void {
    return this.client.onUpdate(api.jackpot.activePrizes, {}, (rows) =>
      cb((rows as any[]).map(mapId) as JackpotPrize[])
    );
  }

  public async upsertPrize(args: {
    key: string;
    label: string;
    kind: JackpotPrizeKind;
    value: string;
    weight: number;
    active: boolean;
  }): Promise<JackpotPrize | null> {
    const row = await this.client.mutation(api.jackpot.upsertPrize, args);
    return row ? (mapId(row as any) as JackpotPrize) : null;
  }

  public async removePrize(key: string): Promise<void> {
    await this.client.mutation(api.jackpot.removePrize, { key });
  }

  public async togglePrizeActive(key: string): Promise<JackpotPrize | null> {
    const row = await this.client.mutation(api.jackpot.toggleActive, { key });
    return row ? (mapId(row as any) as JackpotPrize) : null;
  }

  // ── Jackpot: spins ─────────────────────────────────────────────────────────

  /** Server-side weighted spin + fulfillment. The wheel animates to the result. */
  public async spin(studentId: string, byAdmin: string): Promise<JackpotSpinResult> {
    return (await this.client.mutation(api.jackpot.spin, {
      studentId: studentId as Id<"students">,
      byAdmin,
    })) as JackpotSpinResult;
  }

  public async recentSpins(): Promise<JackpotSpinRow[]> {
    const rows = (await this.client.query(api.jackpot.recentSpins, {})) as any[];
    return rows.map(mapId) as JackpotSpinRow[];
  }

  /** Live subscription to the latest spins. Returns unsubscribe. */
  public subscribeRecentSpins(cb: (rows: JackpotSpinRow[]) => void): () => void {
    return this.client.onUpdate(api.jackpot.recentSpins, {}, (rows) =>
      cb((rows as any[]).map(mapId) as JackpotSpinRow[])
    );
  }

  // ── Marketplace: items ─────────────────────────────────────────────────────

  public async activeItems(): Promise<MarketItem[]> {
    const rows = (await this.client.query(api.market.activeItems, {})) as any[];
    return rows.map(mapId) as MarketItem[];
  }

  /** Live subscription to the student-facing shelf. Returns unsubscribe. */
  public subscribeActiveItems(cb: (items: MarketItem[]) => void): () => void {
    return this.client.onUpdate(api.market.activeItems, {}, (rows) =>
      cb((rows as any[]).map(mapId) as MarketItem[])
    );
  }

  public async adminItems(): Promise<MarketItem[]> {
    const rows = (await this.client.query(api.market.adminItems, {})) as any[];
    return rows.map(mapId) as MarketItem[];
  }

  public async upsertItem(input: UpsertMarketItemInput): Promise<MarketItem | null> {
    const row = await this.client.mutation(api.market.upsertItem, {
      id: input.id ? (input.id as Id<"marketItems">) : undefined,
      name: input.name,
      description: input.description,
      icon: input.icon,
      imageUrl: input.imageUrl ?? undefined,
      pointCost: input.pointCost,
      qtyAvailable: input.qtyAvailable,
      donatedBy: input.donatedBy ?? undefined,
      active: input.active,
    });
    return row ? (mapId(row as any) as MarketItem) : null;
  }

  public async removeItem(id: string): Promise<void> {
    await this.client.mutation(api.market.removeItem, { id: id as Id<"marketItems"> });
  }

  // ── Marketplace: orders ────────────────────────────────────────────────────

  /** Spend points on a donated prize; returns the order with its claim code. */
  public async redeem(studentId: string, itemId: string): Promise<MarketOrder> {
    const row = await this.client.mutation(api.market.redeem, {
      studentId: studentId as Id<"students">,
      itemId: itemId as Id<"marketItems">,
      localDate: localDate(),
    });
    return mapId(row as any) as MarketOrder;
  }

  /** PENDING only: restores quantity and refunds the points. */
  public async cancelOrder(orderId: string, byName: string): Promise<MarketOrder | null> {
    const row = await this.client.mutation(api.market.cancelOrder, {
      orderId: orderId as Id<"marketOrders">,
      byName,
    });
    return row ? (mapId(row as any) as MarketOrder) : null;
  }

  /** Staff matched the claim code at the desk and handed the prize over. */
  public async confirmOrder(orderId: string, byName: string): Promise<MarketOrder | null> {
    const row = await this.client.mutation(api.market.confirmOrder, {
      orderId: orderId as Id<"marketOrders">,
      byName,
    });
    return row ? (mapId(row as any) as MarketOrder) : null;
  }

  public async myOrders(studentId: string): Promise<MarketOrder[]> {
    const rows = (await this.client.query(api.market.myOrders, {
      studentId: studentId as Id<"students">,
    })) as any[];
    return rows.map(mapId) as MarketOrder[];
  }

  /** Live subscription to a kid's own orders. Returns unsubscribe. */
  public subscribeMyOrders(
    studentId: string,
    cb: (orders: MarketOrder[]) => void
  ): () => void {
    return this.client.onUpdate(
      api.market.myOrders,
      { studentId: studentId as Id<"students"> },
      (rows) => cb((rows as any[]).map(mapId) as MarketOrder[])
    );
  }

  public async adminQueue(): Promise<MarketQueue> {
    const result = (await this.client.query(api.market.adminQueue, {})) as any;
    return {
      pending: (result.pending as any[]).map((r) => ({ ...r, order: mapId(r.order) })),
      resolved: (result.resolved as any[]).map((r) => ({ ...r, order: mapId(r.order) })),
    } as MarketQueue;
  }

  /** Live subscription to the pickup queue. Returns unsubscribe. */
  public subscribeAdminQueue(cb: (queue: MarketQueue) => void): () => void {
    return this.client.onUpdate(api.market.adminQueue, {}, (result: any) => {
      cb({
        pending: (result.pending as any[]).map((r) => ({ ...r, order: mapId(r.order) })),
        resolved: (result.resolved as any[]).map((r) => ({ ...r, order: mapId(r.order) })),
      } as MarketQueue);
    });
  }
}

export const marketClient = new MarketClientService();
