// Gear registry — Brawlhalla-meets-Rocket-League power items. One equipped
// piece per athlete; its effects multiply real point earning by source:
//   game    → coach/game awards (MANUAL)
//   checkin → the daily check-in bonus (CHECKIN)
//   earn    → around-town earning (PARTNER_VISIT + SPECIAL_TASK)
// Values are deltas (+0.15 = +15%, negative = downside). The combined gear
// factor per award is clamped to [0.5, 2.0] — gear can at most double a score.
// Shared by client + Convex (same root-import pattern as constants.ts).

export type GearRank = 'C' | 'B' | 'A' | 'S';
export type GearSource = 'game' | 'checkin' | 'earn';

export interface GearUnlock {
  type: 'CHECKINS' | 'LAPS' | 'MEDALS' | 'CRATES' | 'VISITS' | 'LIFETIME_POINTS';
  count: number;
  label: string; // shown in the shop, e.g. "Check in 15 times"
}

export interface GearItemDef {
  key: string;
  name: string;
  rank: GearRank;
  icon: string; // /assets/gear/<key>.png
  effects: Partial<Record<GearSource, number>>;
  price: number; // premium direct-buy price
  unlock?: GearUnlock; // optional grind path (free when earned)
  flavor: string;
}

export const GEAR_RANK_COLORS: Record<GearRank, string> = {
  C: '#9CA3AF',
  B: '#38BDF8',
  A: '#A78BFA',
  S: '#CBFE1C',
};

export const GEAR_SOURCE_LABELS: Record<GearSource, string> = {
  game: 'Game points',
  checkin: 'Check-in bonus',
  earn: 'Around-town earning',
};

export const GEAR_FACTOR_MIN = 0.5;
export const GEAR_FACTOR_MAX = 2.0;

export const GEAR_ITEMS: GearItemDef[] = [
  // ── Rank C — starters, no downsides ─────────────────────────────────────
  {
    key: 'gear_wheel', name: 'Momentum Wheel', rank: 'C', icon: '/assets/gear/gear_wheel.png',
    effects: { game: 0.05 }, price: 200,
    flavor: 'Keep it rolling. Small gains, every game.',
  },
  {
    key: 'gear_medal', name: 'Starter Medallion', rank: 'C', icon: '/assets/gear/gear_medal.png',
    effects: { checkin: 0.10 }, price: 200,
    flavor: 'Show up, cash in. The grind starts at the door.',
  },
  {
    key: 'gear_star', name: 'Rising Star', rank: 'C', icon: '/assets/gear/gear_star.png',
    effects: { game: 0.05, checkin: 0.05 }, price: 300,
    flavor: 'A little shine on everything you do.',
  },

  // ── Rank B — real boosts, real trade-offs ───────────────────────────────
  {
    key: 'gear_potion', name: 'Hustle Juice', rank: 'B', icon: '/assets/gear/gear_potion.png',
    effects: { game: 0.15, checkin: -0.05 }, price: 400,
    flavor: 'Too hyped to line up at the door. Worth it.',
  },
  {
    key: 'gear_scroll', name: "Coach's Scroll", rank: 'B', icon: '/assets/gear/gear_scroll.png',
    effects: { earn: 0.15, game: -0.05 }, price: 400,
    unlock: { type: 'VISITS', count: 3, label: 'Visit 3 partner businesses' },
    flavor: 'Homework pays. Literally.',
  },
  {
    key: 'gear_chest', name: 'Lucky Chest', rank: 'B', icon: '/assets/gear/gear_chest.png',
    effects: { earn: 0.15, checkin: -0.05 }, price: 400,
    unlock: { type: 'CRATES', count: 5, label: 'Open 5 loot crates' },
    flavor: 'Fortune favors the kid who keeps opening.',
  },
  {
    key: 'gear_heart', name: 'Team Heart', rank: 'B', icon: '/assets/gear/gear_heart.png',
    effects: { checkin: 0.10, earn: 0.10, game: -0.10 }, price: 400,
    flavor: 'Plays for the badge on the front, not the name on the back.',
  },
  {
    key: 'gear_scepter', name: 'Sunrise Scepter', rank: 'B', icon: '/assets/gear/gear_scepter.png',
    effects: { checkin: 0.25, earn: -0.10 }, price: 400,
    flavor: 'First one in the gym. Every single day.',
  },

  // ── Rank A — strong builds ───────────────────────────────────────────────
  {
    key: 'gear_crystal', name: 'Focus Crystal', rank: 'A', icon: '/assets/gear/gear_crystal.png',
    effects: { checkin: 0.20, earn: 0.05, game: -0.10 }, price: 800,
    unlock: { type: 'CHECKINS', count: 15, label: 'Check in 15 times' },
    flavor: 'Calm mind, full streak, can\'t lose.',
  },
  {
    key: 'gear_hammer', name: 'Grind Hammer', rank: 'A', icon: '/assets/gear/gear_hammer.png',
    effects: { game: 0.25, earn: -0.10 }, price: 800,
    unlock: { type: 'LAPS', count: 25, label: 'Clock 25 band taps in games' },
    flavor: 'Every rep is a nail. Keep swinging.',
  },
  {
    key: 'gear_watch', name: 'Overtime Watch', rank: 'A', icon: '/assets/gear/gear_watch.png',
    effects: { checkin: 0.20, game: -0.05 }, price: 800,
    unlock: { type: 'CHECKINS', count: 10, label: 'Check in 10 times' },
    flavor: 'Time in the building beats talent at home.',
  },
  {
    key: 'gear_coins', name: "Merchant's Stack", rank: 'A', icon: '/assets/gear/gear_coins.png',
    effects: { earn: 0.25, checkin: -0.10 }, price: 800,
    unlock: { type: 'VISITS', count: 5, label: 'Visit 5 partner businesses' },
    flavor: 'Town runner. Every stop stacks the bag.',
  },
  {
    key: 'gear_shield', name: 'Guardian Shield', rank: 'A', icon: '/assets/gear/gear_shield.png',
    effects: { game: 0.10, checkin: 0.10, earn: 0.10 }, price: 1000,
    flavor: 'No weaknesses. No excuses. The balanced build.',
  },

  // ── Rank S — legends, all-in ─────────────────────────────────────────────
  {
    key: 'gear_sword', name: 'Volt Blade', rank: 'S', icon: '/assets/gear/gear_sword.png',
    effects: { game: 0.30, checkin: -0.10 }, price: 1500,
    unlock: { type: 'MEDALS', count: 3, label: 'Earn 3 coach medals' },
    flavor: 'Forged for Session Legends. Swing big.',
  },
  {
    key: 'gear_diamond', name: 'Diamond Focus', rank: 'S', icon: '/assets/gear/gear_diamond.png',
    effects: { game: 0.20, earn: 0.20, checkin: -0.15 }, price: 1500,
    unlock: { type: 'LIFETIME_POINTS', count: 5000, label: 'Earn 5,000 lifetime points' },
    flavor: 'Pressure made this. Pressure made you.',
  },
  {
    key: 'gear_flame', name: 'Heat Streak', rank: 'S', icon: '/assets/gear/gear_flame.png',
    effects: { game: 0.35, checkin: -0.15, earn: -0.10 }, price: 1500,
    unlock: { type: 'LAPS', count: 50, label: 'Clock 50 band taps in games' },
    flavor: 'All gas. The scoreboard is the only friend you need.',
  },
];

// ── Wave 2 ────────────────────────────────────────────────────────────────
GEAR_ITEMS.push(
  // Rank C — cheap builds
  {
    key: 'gear_satchel', name: "Runner's Satchel", rank: 'C', icon: '/assets/gear/gear_satchel.png',
    effects: { earn: 0.10 }, price: 200,
    flavor: 'Packed light, paid fast.',
  },
  {
    key: 'gear_shroom', name: 'Power Shroom', rank: 'C', icon: '/assets/gear/gear_shroom.png',
    effects: { game: 0.10, earn: -0.05 }, price: 200,
    flavor: 'Grows in the dark. Pops in the game.',
  },
  {
    key: 'gear_goldbar', name: 'Gold Bar', rank: 'C', icon: '/assets/gear/gear_goldbar.png',
    effects: { earn: 0.05, checkin: 0.05 }, price: 300,
    flavor: 'Heavy pockets, steady gains.',
  },
  {
    key: 'gear_banner', name: 'House Banner', rank: 'C', icon: '/assets/gear/gear_banner.png',
    effects: { checkin: 0.10 }, price: 300,
    flavor: 'Fly the colors. Show up loud.',
  },
  {
    key: 'gear_wizhat', name: "Wizard's Cap", rank: 'C', icon: '/assets/gear/gear_wizhat.png',
    effects: { game: 0.05, earn: 0.05 }, price: 300,
    flavor: 'A little magic everywhere you go.',
  },

  // Rank B — sharper trade-offs
  {
    key: 'gear_elixir', name: 'Ember Elixir', rank: 'B', icon: '/assets/gear/gear_elixir.png',
    effects: { game: 0.15, earn: -0.05 }, price: 400,
    flavor: 'Burns slow, hits hard on the floor.',
  },
  {
    key: 'gear_amulet', name: 'Frost Amulet', rank: 'B', icon: '/assets/gear/gear_amulet.png',
    effects: { checkin: 0.15, game: -0.05 }, price: 400,
    flavor: 'Cool head. Cold streaks never miss a day.',
  },
  {
    key: 'gear_pouch', name: 'Bounty Pouch', rank: 'B', icon: '/assets/gear/gear_pouch.png',
    effects: { earn: 0.10, checkin: 0.10, game: -0.10 }, price: 400,
    flavor: 'Collects everywhere except the scoreboard.',
  },
  {
    key: 'gear_lock', name: 'Iron Discipline', rank: 'B', icon: '/assets/gear/gear_lock.png',
    effects: { checkin: 0.15, game: 0.05, earn: -0.10 }, price: 400,
    unlock: { type: 'CHECKINS', count: 20, label: 'Check in 20 times' },
    flavor: 'Locked in. Literally.',
  },
  {
    key: 'gear_cache', name: 'Sunset Cache', rank: 'B', icon: '/assets/gear/gear_cache.png',
    effects: { earn: 0.10, game: 0.05, checkin: -0.05 }, price: 400,
    unlock: { type: 'CRATES', count: 10, label: 'Open 10 loot crates' },
    flavor: 'Every opened crate remembers you.',
  },
  {
    key: 'gear_boots', name: 'Winged Boots', rank: 'B', icon: '/assets/gear/gear_boots.png',
    effects: { game: 0.10, checkin: 0.10, earn: -0.10 }, price: 500,
    unlock: { type: 'LAPS', count: 15, label: 'Clock 15 band taps in games' },
    flavor: 'Fast in the door, faster on the floor.',
  },
  {
    key: 'gear_contract', name: 'Sponsor Contract', rank: 'B', icon: '/assets/gear/gear_contract.png',
    effects: { earn: 0.20, game: -0.10 }, price: 500,
    unlock: { type: 'VISITS', count: 8, label: 'Visit 8 partner businesses' },
    flavor: 'Signed, sealed, sponsored.',
  },

  // Rank A — build definers
  {
    key: 'gear_axe', name: 'Battle Axe', rank: 'A', icon: '/assets/gear/gear_axe.png',
    effects: { game: 0.25, checkin: -0.10 }, price: 800,
    unlock: { type: 'LAPS', count: 35, label: 'Clock 35 band taps in games' },
    flavor: 'Subtlety is for rank C.',
  },
  {
    key: 'gear_viking', name: 'Viking Helm', rank: 'A', icon: '/assets/gear/gear_viking.png',
    effects: { game: 0.20, checkin: 0.10, earn: -0.15 }, price: 800,
    unlock: { type: 'MEDALS', count: 2, label: 'Earn 2 coach medals' },
    flavor: 'Raid the gym. Leave the errands.',
  },
  {
    key: 'gear_map', name: "Explorer's Map", rank: 'A', icon: '/assets/gear/gear_map.png',
    effects: { earn: 0.25, checkin: 0.05, game: -0.15 }, price: 800,
    unlock: { type: 'VISITS', count: 10, label: 'Visit 10 partner businesses' },
    flavor: 'X marks every partner in town.',
  },
  {
    key: 'gear_bomb', name: 'Chaos Bomb', rank: 'A', icon: '/assets/gear/gear_bomb.png',
    effects: { game: 0.30, checkin: -0.15, earn: -0.05 }, price: 800,
    unlock: { type: 'CRATES', count: 15, label: 'Open 15 loot crates' },
    flavor: 'Light the fuse. Apologize later.',
  },
  {
    key: 'gear_portal', name: 'Warp Gate', rank: 'A', icon: '/assets/gear/gear_portal.png',
    effects: { game: 0.15, earn: 0.15, checkin: -0.05 }, price: 1000,
    unlock: { type: 'LIFETIME_POINTS', count: 3000, label: 'Earn 3,000 lifetime points' },
    flavor: 'Everywhere at once. Almost.',
  },

  // Rank S — endgame
  {
    key: 'gear_mjolnir', name: 'Thunder Maul', rank: 'S', icon: '/assets/gear/gear_mjolnir.png',
    effects: { game: 0.35, checkin: -0.20 }, price: 1500,
    unlock: { type: 'MEDALS', count: 5, label: 'Earn 5 coach medals' },
    flavor: 'Whoever holds this hammer owns the floor.',
  },
  {
    key: 'gear_trophy', name: 'Golden Chalice', rank: 'S', icon: '/assets/gear/gear_trophy.png',
    effects: { game: 0.25, earn: 0.25, checkin: -0.20 }, price: 1500,
    unlock: { type: 'LIFETIME_POINTS', count: 10000, label: 'Earn 10,000 lifetime points' },
    flavor: 'You did not find the chalice. It found you.',
  },
  {
    key: 'gear_aegis', name: 'Aegis Ward', rank: 'S', icon: '/assets/gear/gear_aegis.png',
    effects: { game: 0.15, checkin: 0.15, earn: 0.15 }, price: 1800,
    unlock: { type: 'CHECKINS', count: 40, label: 'Check in 40 times' },
    flavor: 'The perfect build has no weaknesses. This is it.',
  },
);

export const gearItem = (key?: string | null): GearItemDef | undefined =>
  GEAR_ITEMS.find((g) => g.key === key);

// The multiplier a piece of gear applies to one earning source.
export function gearFactor(key: string | null | undefined, source: GearSource): number {
  const item = gearItem(key);
  if (!item) return 1;
  const delta = item.effects[source] ?? 0;
  const factor = 1 + delta;
  return Math.min(GEAR_FACTOR_MAX, Math.max(GEAR_FACTOR_MIN, factor));
}
