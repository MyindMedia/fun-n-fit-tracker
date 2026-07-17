// Loadout service: consumable gear boosts (Wave 3). Same singleton +
// ConvexClient pattern as services/gameCenter.ts, kept separate so the gear
// activation surface has its own client without touching the frozen service.
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

export type LoadoutItemState = "READY" | "ACTIVE" | "USED_TODAY";

export interface LoadoutItem {
  key: string;
  state: LoadoutItemState;
  oneShot: boolean;
  expiresAt: number | null;
}

export interface LoadoutState {
  active: { gearKey: string; kind: "DAILY" | "ONE_SHOT"; expiresAt: number } | null;
  items: LoadoutItem[];
}

class LoadoutService {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  /** Owned consumables with per-item state plus the live boost, if any. */
  public async loadout(studentId: string, localDate?: string): Promise<LoadoutState> {
    return (await this.client.query(api.gear.loadout, {
      studentId: studentId as Id<"students">,
      localDate,
    })) as LoadoutState;
  }

  /** Fire a consumable. Server enforces ownership, one-at-a-time, and daily cooldowns. */
  public async activateGear(
    studentId: string,
    gearKey: string,
    localDate?: string
  ): Promise<{ ok: boolean; expiresAt: number }> {
    return (await this.client.mutation(api.gear.activate, {
      studentId: studentId as Id<"students">,
      gearKey,
      localDate,
    })) as { ok: boolean; expiresAt: number };
  }
}

export const loadoutClient = new LoadoutService();
