// Volt System service: BO6-style perk loadout profile + equip. Same
// singleton + ConvexClient pattern as services/gameCenter.ts, kept separate
// so the Volt surface has its own client without touching frozen services.
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { VoltEffects, VoltLoadout, VoltSpecialty } from "../voltCatalog";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  "https://dependable-spoonbill-535.convex.cloud";

export type VoltSlotKey = "perk1" | "perk2" | "perk3" | "flex" | "wildcard";

export interface VoltNextLevel {
  nextLevel: number;
  needed: number;
  span: number;
}

export interface VoltStats {
  currentPoints: number;
  lifetimePoints: number;
  checkIns: number;
  medals: number;
  cratesOpened: number;
  partnerVisits: number;
  tradesDone: number;
  bandTaps: number;
}

// Mirrors the convex/volt.ts profile query payload exactly.
export interface VoltProfile {
  xp: number;
  level: number;
  nextLevel: VoltNextLevel | null; // null at max level
  loadout: VoltLoadout;
  activeSpecialty: VoltSpecialty | null;
  effects: Required<VoltEffects>;
  unlockedPerks: string[];
  unlockedWildcards: string[];
  stats: VoltStats;
}

export interface VoltEquipResult {
  ok: boolean;
  loadout: VoltLoadout;
  activeSpecialty: VoltSpecialty | null;
}

class VoltService {
  private client: ConvexClient;

  constructor() {
    this.client = new ConvexClient(CONVEX_URL);
  }

  /** Full Volt profile: XP, level, loadout, unlocks, and the stats grid. */
  public async profile(studentId: string): Promise<VoltProfile> {
    return (await this.client.query(api.volt.profile, {
      studentId: studentId as Id<"students">,
    })) as VoltProfile;
  }

  /** Equip (or clear with key=null) one slot of the loadout. */
  public async equip(
    studentId: string,
    slot: VoltSlotKey,
    key: string | null
  ): Promise<VoltEquipResult> {
    return (await this.client.mutation(api.volt.equip, {
      studentId: studentId as Id<"students">,
      slot,
      key,
    })) as VoltEquipResult;
  }

  /** Live subscription to the Volt profile. Returns unsubscribe. */
  public subscribeProfile(
    studentId: string,
    cb: (profile: VoltProfile) => void
  ): () => void {
    return this.client.onUpdate(
      api.volt.profile,
      { studentId: studentId as Id<"students"> },
      (p) => cb(p as VoltProfile)
    );
  }
}

export const voltClient = new VoltService();
