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
// PASSIVE = always-on while equipped (default). DAILY = activate once per day,
// effect lasts durationMin, then cools down until midnight. ONE_SHOT = single
// use: activating consumes the item (re-earn or re-buy).
export type GearUsage = 'PASSIVE' | 'DAILY' | 'ONE_SHOT';

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
  usage?: GearUsage; // undefined = PASSIVE (always-on equipped slot)
  durationMin?: number; // DAILY/ONE_SHOT effect window (default 15)
  tradable?: boolean; // GEAR trades only when explicitly true
  xpBoost?: number; // consumables only: extra XP factor while live (+1.0 = 2x XP)
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
    effects: { game: 0.05 }, price: 200, tradable: true,
    flavor: 'Keep it rolling. Small gains, every game.',
  },
  {
    key: 'gear_medal', name: 'Starter Medallion', rank: 'C', icon: '/assets/gear/gear_medal.png',
    effects: { checkin: 0.10 }, price: 200, tradable: true,
    flavor: 'Show up, cash in. The grind starts at the door.',
  },
  {
    key: 'gear_star', name: 'Rising Star', rank: 'C', icon: '/assets/gear/gear_star.png',
    effects: { game: 0.05, checkin: 0.05 }, price: 300, tradable: true,
    flavor: 'A little shine on everything you do.',
  },

  // ── Rank B — real boosts, real trade-offs ───────────────────────────────
  {
    key: 'gear_potion', name: 'Hustle Juice', rank: 'B', icon: '/assets/gear/gear_potion.png',
    effects: { game: 0.15, checkin: -0.05 }, price: 400, tradable: true,
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
    effects: { checkin: 0.10, earn: 0.10, game: -0.10 }, price: 400, tradable: true,
    flavor: 'Plays for the badge on the front, not the name on the back.',
  },
  {
    key: 'gear_scepter', name: 'Sunrise Scepter', rank: 'B', icon: '/assets/gear/gear_scepter.png',
    effects: { checkin: 0.25, earn: -0.10 }, price: 400, tradable: true,
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
    effects: { earn: 0.10 }, price: 200, tradable: true,
    flavor: 'Packed light, paid fast.',
  },
  {
    key: 'gear_shroom', name: 'Power Shroom', rank: 'C', icon: '/assets/gear/gear_shroom.png',
    effects: { game: 0.10, earn: -0.05 }, price: 200, tradable: true,
    flavor: 'Grows in the dark. Pops in the game.',
  },
  {
    key: 'gear_goldbar', name: 'Gold Bar', rank: 'C', icon: '/assets/gear/gear_goldbar.png',
    effects: { earn: 0.05, checkin: 0.05 }, price: 300, tradable: true,
    flavor: 'Heavy pockets, steady gains.',
  },
  {
    key: 'gear_banner', name: 'House Banner', rank: 'C', icon: '/assets/gear/gear_banner.png',
    effects: { checkin: 0.10 }, price: 300, tradable: true,
    flavor: 'Fly the colors. Show up loud.',
  },
  {
    key: 'gear_wizhat', name: "Wizard's Cap", rank: 'C', icon: '/assets/gear/gear_wizhat.png',
    effects: { game: 0.05, earn: 0.05 }, price: 300, tradable: true,
    flavor: 'A little magic everywhere you go.',
  },

  // Rank B — sharper trade-offs
  {
    key: 'gear_elixir', name: 'Ember Elixir', rank: 'B', icon: '/assets/gear/gear_elixir.png',
    effects: { game: 0.15, earn: -0.05 }, price: 400, tradable: true,
    flavor: 'Burns slow, hits hard on the floor.',
  },
  {
    key: 'gear_amulet', name: 'Frost Amulet', rank: 'B', icon: '/assets/gear/gear_amulet.png',
    effects: { checkin: 0.15, game: -0.05 }, price: 400, tradable: true,
    flavor: 'Cool head. Cold streaks never miss a day.',
  },
  {
    key: 'gear_pouch', name: 'Bounty Pouch', rank: 'B', icon: '/assets/gear/gear_pouch.png',
    effects: { earn: 0.10, checkin: 0.10, game: -0.10 }, price: 400, tradable: true,
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

// ── Wave 3: consumables ───────────────────────────────────────────────────
// Boosts you fire, not wear. DAILY items recharge at midnight; ONE_SHOT items
// burn up on use. No downsides on consumables: the price and the vanish ARE
// the downside. Icons reuse existing /assets/gear art (keys stay unique).
GEAR_ITEMS.push(
  // DAILY: once a day, 15 minutes of shine
  {
    key: 'gear_surge', name: 'Surge Soda', rank: 'B', icon: '/assets/gear/gear_potion.png',
    effects: { game: 0.40 }, price: 300, usage: 'DAILY', durationMin: 15,
    flavor: 'Shake. Crack. Score. Fifteen minutes of fizz.',
  },
  {
    key: 'gear_zoom', name: 'Zoom Juice', rank: 'B', icon: '/assets/gear/gear_elixir.png',
    effects: { earn: 0.50 }, price: 300, usage: 'DAILY', durationMin: 15,
    flavor: 'Every stop around town pays extra while it lasts.',
  },
  {
    key: 'gear_prisma', name: 'Prism Charge', rank: 'A', icon: '/assets/gear/gear_crystal.png',
    effects: { game: 0.25, checkin: 0.25, earn: 0.25 }, price: 400, usage: 'DAILY', durationMin: 15,
    flavor: 'One charge, every color of points at once.',
  },

  // ONE_SHOT: the big red buttons
  {
    key: 'gear_nova', name: 'Nova Bomb', rank: 'S', icon: '/assets/gear/gear_bomb.png',
    effects: { game: 1.0 }, price: 500, usage: 'ONE_SHOT', durationMin: 15,
    flavor: 'Double game points for fifteen minutes. Then it is gone. Boom.',
  },
  {
    key: 'gear_inferno', name: 'Inferno Shot', rank: 'S', icon: '/assets/gear/gear_flame.png',
    effects: { game: 0.75, earn: 0.25 }, price: 600, usage: 'ONE_SHOT', durationMin: 15,
    flavor: 'One match. One blaze. One session nobody forgets.',
  },
  {
    key: 'gear_wishstar', name: 'Wishing Star', rank: 'S', icon: '/assets/gear/gear_star.png',
    effects: { game: 0.60, earn: 0.60 }, price: 500, usage: 'ONE_SHOT', durationMin: 15,
    unlock: { type: 'CHECKINS', count: 30, label: 'Check in 30 times' },
    flavor: 'You did the work. The sky owes you one.',
  },
);

// ── Wave 4: XP tokens (Volt System) ──────────────────────────────────────────
// Timed Double-XP tokens, COD-style. No point effects — they multiply the XP
// mirror in applyPoints while live (xpBoost +1.0 = 2x XP). Consumed on use.
GEAR_ITEMS.push(
  {
    key: 'xp_spark', name: 'XP Spark', rank: 'B', icon: '/assets/gear/gear_star.png',
    effects: {}, price: 150, usage: 'ONE_SHOT', durationMin: 15, xpBoost: 1.0,
    flavor: 'Double XP. Fifteen minutes. Make them count.',
  },
  {
    key: 'xp_storm', name: 'XP Storm', rank: 'A', icon: '/assets/gear/gear_crystal.png',
    effects: {}, price: 300, usage: 'ONE_SHOT', durationMin: 15, xpBoost: 2.0,
    flavor: 'Triple XP rolls in like weather. Nothing stays dry.',
  },
);

export const gearItem = (key?: string | null): GearItemDef | undefined =>
  GEAR_ITEMS.find((g) => g.key === key);

export const GEAR_DEFAULT_DURATION_MIN = 15;

// Consumables activate from the loadout; they never sit in the equipped slot.
export const isConsumable = (item?: GearItemDef | null): boolean =>
  item?.usage === 'DAILY' || item?.usage === 'ONE_SHOT';

// Raw per-source delta (unclamped). applyPoints combines the passive delta
// with a live boost delta and clamps the PRODUCT once to [0.5, 2.0].
export function gearDelta(key: string | null | undefined, source: GearSource): number {
  return gearItem(key)?.effects[source] ?? 0;
}

// The multiplier a piece of gear applies to one earning source.
export function gearFactor(key: string | null | undefined, source: GearSource): number {
  const item = gearItem(key);
  if (!item) return 1;
  const delta = item.effects[source] ?? 0;
  const factor = 1 + delta;
  return Math.min(GEAR_FACTOR_MAX, Math.max(GEAR_FACTOR_MIN, factor));
}
