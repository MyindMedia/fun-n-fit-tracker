// Volt System registry — BO6-style perks, wildcards, specialties, and levels.
// Shared by the client renderer and Convex (same root-import pattern as
// constants.ts / gearCatalog.ts). Perks are FREE to equip once unlocked by
// Volt Level; every percentage effect flows through applyPoints' combined
// factor and respects the global clamp. No money anywhere in this system.

export type VoltSpecialty = 'STRIKER' | 'SCOUT' | 'CAPTAIN';
export type VoltSlot = 1 | 2 | 3;
export type VoltWildcardRule =
  | 'MARATHON' // boosts/XP tokens run 25 min base
  | 'DOUBLE_BOOST' // two live activations at once
  | 'HIGH_ROLLER' // +2 loot crates per day
  | 'PERK_GREED' // 4th flex perk (any row)
  | 'XP_TYCOON'; // +25% XP always

// Merged bonus shape. All *Pct values are whole percents (5 = +5%).
export interface VoltEffects {
  gamePct?: number; // coach/game awards (MANUAL)
  earnPct?: number; // partner visits + special tasks
  checkinFlat?: number; // flat bonus points on the daily check-in
  xpPct?: number; // extra XP on everything earned
  shopDiscountPct?: number; // gear + avatar point purchases
  crateCapPlus?: number; // extra loot crate opens per day
  tradeSlotsPlus?: number; // extra open trade offers
  shardRefundPct?: number; // crate dupe shard refund (replaces the base 40)
  boostMinutesPlus?: number; // extra minutes on consumable activations
  demotionShield?: boolean; // no penalty points on spend demotions
}

export interface VoltPerkDef {
  key: string;
  name: string;
  slot: VoltSlot;
  specialty: VoltSpecialty;
  unlockLevel: number;
  icon: string; // Ic icon name engraved on the medallion
  blurb: string; // kid-friendly effect line
  effects: VoltEffects;
}

export interface VoltWildcardDef {
  key: string;
  name: string;
  unlockLevel: number;
  icon: string;
  blurb: string;
  rule: VoltWildcardRule;
  effects?: VoltEffects;
}

export interface VoltLoadout {
  perk1?: string | null;
  perk2?: string | null;
  perk3?: string | null;
  flex?: string | null; // 4th perk, only with the Perk Greed wildcard
  wildcard?: string | null;
}

export const VOLT_SPECIALTY_META: Record<
  VoltSpecialty,
  { name: string; color: string; bonusName: string; bonusBlurb: string; icon: string; bonus: VoltEffects }
> = {
  STRIKER: {
    name: 'Striker',
    color: '#CBFE1C',
    bonusName: 'Volt Surge',
    bonusBlurb: 'All three Striker perks: +5% game points and +5% XP on top.',
    icon: 'Bolt',
    bonus: { gamePct: 5, xpPct: 5 },
  },
  SCOUT: {
    name: 'Scout',
    color: '#2FA8FF',
    bonusName: 'Trailblazer',
    bonusBlurb: 'All three Scout perks: +10% around-town points on top.',
    icon: 'MapPin',
    bonus: { earnPct: 10 },
  },
  CAPTAIN: {
    name: 'Captain',
    color: '#A78BFA',
    bonusName: 'Team Captain',
    bonusBlurb: 'All three Captain perks: +5 check-in points and 5% shop discount on top.',
    icon: 'Flag',
    bonus: { checkinFlat: 5, shopDiscountPct: 5 },
  },
};

export const VOLT_SLOT_LABELS: Record<VoltSlot, string> = {
  1: 'Hustle',
  2: 'Game',
  3: 'Legend',
};

export const VOLT_PERKS: VoltPerkDef[] = [
  // ── Row 1 — HUSTLE ────────────────────────────────────────────────────────
  {
    key: 'fast_start', name: 'Fast Start', slot: 1, specialty: 'STRIKER', unlockLevel: 1,
    icon: 'Bolt', blurb: '+5% points from games.', effects: { gamePct: 5 },
  },
  {
    key: 'early_bird', name: 'Early Bird', slot: 1, specialty: 'CAPTAIN', unlockLevel: 2,
    icon: 'Timer', blurb: '+5 bonus points every daily check-in.', effects: { checkinFlat: 5 },
  },
  {
    key: 'trail_mix', name: 'Trail Mix', slot: 1, specialty: 'SCOUT', unlockLevel: 4,
    icon: 'MapPin', blurb: '+10% points around town.', effects: { earnPct: 10 },
  },
  {
    key: 'warm_up', name: 'Warm-Up', slot: 1, specialty: 'STRIKER', unlockLevel: 7,
    icon: 'Run', blurb: '+10% XP on everything you earn.', effects: { xpPct: 10 },
  },
  {
    key: 'piggy_bank', name: 'Piggy Bank', slot: 1, specialty: 'CAPTAIN', unlockLevel: 10,
    icon: 'Coin', blurb: 'Shop items cost 5% fewer points.', effects: { shopDiscountPct: 5 },
  },

  // ── Row 2 — GAME ──────────────────────────────────────────────────────────
  {
    key: 'sharpshooter', name: 'Sharpshooter', slot: 2, specialty: 'STRIKER', unlockLevel: 3,
    icon: 'Target', blurb: '+10% points from games.', effects: { gamePct: 10 },
  },
  {
    key: 'collector', name: 'Collector', slot: 2, specialty: 'SCOUT', unlockLevel: 6,
    icon: 'Dice', blurb: 'Open 1 extra loot crate per day.', effects: { crateCapPlus: 1 },
  },
  {
    key: 'deal_maker', name: 'Deal Maker', slot: 2, specialty: 'CAPTAIN', unlockLevel: 9,
    icon: 'Users', blurb: 'Keep 2 extra trade offers open.', effects: { tradeSlotsPlus: 2 },
  },
  {
    key: 'momentum', name: 'Momentum', slot: 2, specialty: 'STRIKER', unlockLevel: 13,
    icon: 'Fire', blurb: 'Boosts run 5 extra minutes.', effects: { boostMinutesPlus: 5 },
  },
  {
    key: 'bargain_hunter', name: 'Bargain Hunter', slot: 2, specialty: 'SCOUT', unlockLevel: 17,
    icon: 'Tag', blurb: 'Crate dupes refund 60% shards.', effects: { shardRefundPct: 60 },
  },

  // ── Row 3 — LEGEND ────────────────────────────────────────────────────────
  {
    key: 'finisher', name: 'Finisher', slot: 3, specialty: 'STRIKER', unlockLevel: 5,
    icon: 'Flag', blurb: '+10% XP on everything you earn.', effects: { xpPct: 10 },
  },
  {
    key: 'town_hero', name: 'Town Hero', slot: 3, specialty: 'SCOUT', unlockLevel: 8,
    icon: 'Store', blurb: '+15% points from partner visits and tasks.', effects: { earnPct: 15 },
  },
  {
    key: 'bankroll', name: 'Bankroll', slot: 3, specialty: 'CAPTAIN', unlockLevel: 11,
    icon: 'StarFilled', blurb: '+10 bonus points every daily check-in.', effects: { checkinFlat: 10 },
  },
  {
    key: 'iron_will', name: 'Iron Will', slot: 3, specialty: 'CAPTAIN', unlockLevel: 15,
    icon: 'Muscle', blurb: 'Big shop spends never cost penalty points.', effects: { demotionShield: true },
  },
  {
    key: 'overtime', name: 'Overtime', slot: 3, specialty: 'STRIKER', unlockLevel: 19,
    icon: 'Trophy', blurb: '+5% game points and +5% XP.', effects: { gamePct: 5, xpPct: 5 },
  },
];

export const VOLT_WILDCARDS: VoltWildcardDef[] = [
  {
    key: 'marathon', name: 'Marathon', unlockLevel: 12, icon: 'Run',
    blurb: 'Boosts and XP tokens run 25 minutes instead of 15.', rule: 'MARATHON',
  },
  {
    key: 'double_down', name: 'Double Down', unlockLevel: 16, icon: 'Dice',
    blurb: 'Run two boosts at the same time.', rule: 'DOUBLE_BOOST',
  },
  {
    key: 'high_roller', name: 'High Roller', unlockLevel: 21, icon: 'Gift',
    blurb: 'Open 2 extra loot crates per day.', rule: 'HIGH_ROLLER',
    effects: { crateCapPlus: 2 },
  },
  {
    key: 'perk_greed', name: 'Perk Greed', unlockLevel: 26, icon: 'Plus',
    blurb: 'Equip a fourth perk from any row.', rule: 'PERK_GREED',
  },
  {
    key: 'xp_tycoon', name: 'XP Tycoon', unlockLevel: 32, icon: 'Chart',
    blurb: '+25% XP on everything, always.', rule: 'XP_TYCOON',
    effects: { xpPct: 25 },
  },
];

// ── Volt Levels ───────────────────────────────────────────────────────────────
// Cumulative XP needed to REACH level n (level 1 = 0). threshold(n) grows
// quadratically so early levels come fast and late ones are a season grind.
export const VOLT_MAX_LEVEL = 40;

export const VOLT_LEVELS: number[] = Array.from({ length: VOLT_MAX_LEVEL }, (_, i) => {
  const n = i + 1;
  return (n - 1) * (25 * n + 50);
});

export const voltLevelForXp = (xp: number): number => {
  let level = 1;
  for (let n = VOLT_MAX_LEVEL; n >= 1; n--) {
    if (xp >= VOLT_LEVELS[n - 1]) { level = n; break; }
  }
  return level;
};

export const voltXpForLevel = (level: number): number =>
  VOLT_LEVELS[Math.min(Math.max(level, 1), VOLT_MAX_LEVEL) - 1];

export const voltNextLevelXp = (xp: number): { nextLevel: number; needed: number; span: number } | null => {
  const level = voltLevelForXp(xp);
  if (level >= VOLT_MAX_LEVEL) return null;
  const cur = voltXpForLevel(level);
  const next = voltXpForLevel(level + 1);
  return { nextLevel: level + 1, needed: next - xp, span: next - cur };
};

// ── Lookups + merged-effects helper ──────────────────────────────────────────

export const voltPerk = (key?: string | null): VoltPerkDef | undefined =>
  VOLT_PERKS.find((p) => p.key === key);

export const voltWildcard = (key?: string | null): VoltWildcardDef | undefined =>
  VOLT_WILDCARDS.find((w) => w.key === key);

// The specialty granted when perk1/perk2/perk3 all share one (BO6 rule).
export const voltActiveSpecialty = (loadout?: VoltLoadout | null): VoltSpecialty | null => {
  if (!loadout) return null;
  const specs = ([loadout.perk1, loadout.perk2, loadout.perk3] as const).map(
    (k) => voltPerk(k)?.specialty
  );
  if (specs[0] && specs[0] === specs[1] && specs[1] === specs[2]) return specs[0];
  return null;
};

const addEffects = (into: Required<VoltEffects>, e?: VoltEffects) => {
  if (!e) return;
  into.gamePct += e.gamePct ?? 0;
  into.earnPct += e.earnPct ?? 0;
  into.checkinFlat += e.checkinFlat ?? 0;
  into.xpPct += e.xpPct ?? 0;
  into.shopDiscountPct += e.shopDiscountPct ?? 0;
  into.crateCapPlus += e.crateCapPlus ?? 0;
  into.tradeSlotsPlus += e.tradeSlotsPlus ?? 0;
  into.shardRefundPct = Math.max(into.shardRefundPct, e.shardRefundPct ?? 0);
  into.boostMinutesPlus += e.boostMinutesPlus ?? 0;
  into.demotionShield = into.demotionShield || !!e.demotionShield;
};

// Everything the loadout grants, merged: perks + specialty bonus + wildcard.
export const voltEffects = (loadout?: VoltLoadout | null): Required<VoltEffects> => {
  const total: Required<VoltEffects> = {
    gamePct: 0, earnPct: 0, checkinFlat: 0, xpPct: 0, shopDiscountPct: 0,
    crateCapPlus: 0, tradeSlotsPlus: 0, shardRefundPct: 0, boostMinutesPlus: 0,
    demotionShield: false,
  };
  if (!loadout) return total;
  for (const key of [loadout.perk1, loadout.perk2, loadout.perk3, loadout.flex]) {
    addEffects(total, voltPerk(key)?.effects);
  }
  const spec = voltActiveSpecialty(loadout);
  if (spec) addEffects(total, VOLT_SPECIALTY_META[spec].bonus);
  addEffects(total, voltWildcard(loadout.wildcard)?.effects);
  return total;
};

export const voltRule = (loadout: VoltLoadout | null | undefined, rule: VoltWildcardRule): boolean =>
  voltWildcard(loadout?.wildcard)?.rule === rule;

// XP sources that mirror point earnings (spends/refunds/system never grant XP).
export const XP_SOURCES = ['MANUAL', 'CHECKIN', 'PARTNER_VISIT', 'SPECIAL_TASK', 'FIT', 'JACKPOT'];
export const XP_FACTOR_MAX = 4.0;
