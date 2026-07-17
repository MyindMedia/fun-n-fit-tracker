// Avatar item registry + palettes, shared by the client renderer and the
// Convex seed/loot mutations (same root-import pattern as constants.ts).
// The SVG rig in components/avatar/AvatarRig.tsx keys off item `key`s —
// wearables.filePath is unused for these items.

export type AvatarSlot = 'HAIRSTYLE' | 'TOP' | 'ACCESSORY';
export type AvatarRarity = 'common' | 'uncommon' | 'legendary';

export interface AvatarItemDef {
  key: string;
  name: string;
  slot: AvatarSlot;
  rarity: AvatarRarity;
  cost: number; // direct-buy price in points
  isDefault?: boolean; // everyone owns it
  tag?: 'M' | 'F' | 'U'; // studio sorting hint (boy / girl / unisex); everything stays wearable by everyone
  tokenPrice?: number; // alternate FitTokens price (vanity-only currency)
  tradable?: boolean; // default true for non-default items; false locks trading
}

export interface AvatarLook {
  body?: 'M' | 'F'; // base style (defaults from the athlete's gender)
  skin?: string; // SKIN_TONES id
  hairColor?: string; // HAIR_COLORS hex
  hair?: string; // HAIRSTYLE item key
  top?: string; // TOP item key
  acc?: string | null; // ACCESSORY item key, null = none
}

export const SKIN_TONES: Array<{ id: string; fill: string; shade: string }> = [
  { id: 's1', fill: '#F8D9C4', shade: '#E3B99C' },
  { id: 's2', fill: '#F0C29E', shade: '#D9A377' },
  { id: 's3', fill: '#D99E6E', shade: '#BE8150' },
  { id: 's4', fill: '#B97C50', shade: '#9C6238' },
  { id: 's5', fill: '#8D5A3B', shade: '#71452A' },
  { id: 's6', fill: '#5F3B26', shade: '#472A19' },
];

export const HAIR_COLORS: string[] = [
  '#1B1B22', // black
  '#3E2A1E', // dark brown
  '#6E4A2F', // brown
  '#B7833F', // blonde
  '#C7502F', // ginger
  '#8E8E97', // silver
  '#7C3AED', // purple
  '#2FA8FF', // blue
];

export const DEFAULT_LOOK: Required<Omit<AvatarLook, 'acc' | 'body'>> & { acc: string | null; body?: 'M' | 'F' } = {
  skin: 's3',
  hairColor: '#1B1B22',
  hair: 'hair_short',
  top: 'top_tee',
  acc: null,
};

// FitTokens price ladder (vanity-only currency): common 10, uncommon 25,
// legendary 60. Default items stay free and have no token price. Legendary
// items are non-tradable so top-shelf cosmetics stay earned or bought.
export const AVATAR_ITEMS: AvatarItemDef[] = [
  // ── Hair — boys' set (free starters first) ─────────────────────────────────
  { key: 'hair_buzz', name: 'Buzz Cut', slot: 'HAIRSTYLE', rarity: 'common', cost: 0, isDefault: true, tag: 'M' },
  { key: 'hair_short', name: 'Fresh Fade', slot: 'HAIRSTYLE', rarity: 'common', cost: 0, isDefault: true, tag: 'M' },
  { key: 'hair_sidepart', name: 'Side Part', slot: 'HAIRSTYLE', rarity: 'common', cost: 0, isDefault: true, tag: 'M' },
  { key: 'hair_spiky', name: 'Spike Up', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'M' },
  { key: 'hair_bowl', name: 'Bowl Cut', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'M' },
  { key: 'hair_slickback', name: 'Slick Back', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'M' },
  { key: 'hair_flattop', name: 'Flat Top', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'M' },
  { key: 'hair_curtains', name: 'Curtains', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'M' },
  { key: 'hair_broccoli', name: 'Broccoli Perm', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'M' },
  { key: 'hair_cornrows', name: 'Cornrows', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'M' },
  { key: 'hair_mohawk', name: 'Volt Hawk', slot: 'HAIRSTYLE', rarity: 'legendary', cost: 600, tokenPrice: 60, tradable: false, tag: 'M' },

  // ── Hair — girls' set (free starters first) ────────────────────────────────
  { key: 'hair_bob', name: 'Classic Bob', slot: 'HAIRSTYLE', rarity: 'common', cost: 0, isDefault: true, tag: 'F' },
  { key: 'hair_ponytail', name: 'Power Ponytail', slot: 'HAIRSTYLE', rarity: 'common', cost: 0, isDefault: true, tag: 'F' },
  { key: 'hair_buns', name: 'Space Buns', slot: 'HAIRSTYLE', rarity: 'common', cost: 0, isDefault: true, tag: 'F' },
  { key: 'hair_pigtails', name: 'Pigtails', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'F' },
  { key: 'hair_bangs', name: 'Straight Bangs', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'F' },
  { key: 'hair_halfup', name: 'Half-Up', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'F' },
  { key: 'hair_long', name: 'Flow', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'F' },
  { key: 'hair_braids', name: 'Twin Braids', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'F' },
  { key: 'hair_waves', name: 'Beach Waves', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'F' },
  { key: 'hair_puffs', name: 'Double Puffs', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'F' },
  { key: 'hair_sidebraid', name: 'Side Braid', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'F' },
  { key: 'hair_curlypony', name: 'Curly Pony', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'F' },

  // ── Hair — everyone ─────────────────────────────────────────────────────────
  { key: 'hair_curls', name: 'Cloud Curls', slot: 'HAIRSTYLE', rarity: 'common', cost: 75, tokenPrice: 10, tag: 'U' },
  { key: 'hair_afro', name: 'Fresh Afro', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'U' },
  { key: 'hair_locs', name: 'Locs', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'U' },
  { key: 'hair_bun', name: 'Top Knot', slot: 'HAIRSTYLE', rarity: 'uncommon', cost: 150, tokenPrice: 25, tag: 'U' },

  // ── Tops (clothes + house merch; free starters, elite kit) ─────────────────
  { key: 'top_tee', name: 'Academy Tee', slot: 'TOP', rarity: 'common', cost: 0, isDefault: true },
  { key: 'top_tank', name: 'Training Tank', slot: 'TOP', rarity: 'common', cost: 0, isDefault: true },
  { key: 'top_stripe', name: 'Stripe Tee', slot: 'TOP', rarity: 'common', cost: 0, isDefault: true },
  { key: 'top_ringer', name: 'Ringer Tee', slot: 'TOP', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'top_polo', name: 'Club Polo', slot: 'TOP', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'top_hoodie', name: 'Gym Hoodie', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_track', name: 'Track Jacket', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_varsity', name: 'Varsity Jacket', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_jersey_unity', name: 'Unity Jersey', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_jersey_sage', name: 'Sage Jersey', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_jersey_spark', name: 'Spark Jersey', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_jersey_valor', name: 'Valor Jersey', slot: 'TOP', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'top_champion', name: 'Champion Jacket', slot: 'TOP', rarity: 'legendary', cost: 600, tokenPrice: 60, tradable: false },
  { key: 'top_gold', name: 'Elite Gold Kit', slot: 'TOP', rarity: 'legendary', cost: 600, tokenPrice: 60, tradable: false },

  // ── Accessories (free starters, hats/helmets/goggles, elite) ───────────────
  { key: 'acc_headband', name: 'Sweat Band', slot: 'ACCESSORY', rarity: 'common', cost: 0, isDefault: true },
  { key: 'acc_bandana', name: 'Team Bandana', slot: 'ACCESSORY', rarity: 'common', cost: 0, isDefault: true },
  { key: 'acc_glasses', name: 'Scholar Glasses', slot: 'ACCESSORY', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'acc_shades', name: 'Volt Visor', slot: 'ACCESSORY', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'acc_cap', name: 'Academy Cap', slot: 'ACCESSORY', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'acc_goggles', name: 'Sport Goggles', slot: 'ACCESSORY', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'acc_eyeblack', name: 'Game-Day Eye Black', slot: 'ACCESSORY', rarity: 'common', cost: 75, tokenPrice: 10 },
  { key: 'acc_beanie', name: 'Street Beanie', slot: 'ACCESSORY', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'acc_bucket', name: 'Bucket Hat', slot: 'ACCESSORY', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'acc_helmet', name: 'Pro Helmet', slot: 'ACCESSORY', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'acc_headphones', name: 'Coach Comms', slot: 'ACCESSORY', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'acc_scarf', name: 'Team Scarf', slot: 'ACCESSORY', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'acc_chain', name: 'Gold Chain', slot: 'ACCESSORY', rarity: 'uncommon', cost: 150, tokenPrice: 25 },
  { key: 'acc_crown', name: 'Legend Crown', slot: 'ACCESSORY', rarity: 'legendary', cost: 600, tokenPrice: 60, tradable: false },
  { key: 'acc_volt_helmet', name: 'Volt Racing Helmet', slot: 'ACCESSORY', rarity: 'legendary', cost: 600, tokenPrice: 60, tradable: false },
];

export const avatarItem = (key?: string | null): AvatarItemDef | undefined =>
  AVATAR_ITEMS.find((i) => i.key === key);

export const RARITY_COLORS: Record<AvatarRarity, string> = {
  common: '#9CA3AF',
  uncommon: '#34D399',
  legendary: '#CBFE1C',
};

// ── Loot crates (points-only; odds shown in UI, enforced server-side) ───────
export interface LootBoxDef {
  key: 'STANDARD' | 'PREMIUM';
  name: string;
  cost: number;
  odds: Record<AvatarRarity, number>; // percent, sums to 100
}

export const LOOT_BOXES: LootBoxDef[] = [
  { key: 'STANDARD', name: 'Standard Crate', cost: 100, odds: { common: 70, uncommon: 25, legendary: 5 } },
  { key: 'PREMIUM', name: 'Premium Crate', cost: 250, odds: { common: 40, uncommon: 45, legendary: 15 } },
];

export const LOOT_DAILY_CAP = 3; // opens per kid per day, all crates combined
export const MAX_UPGRADE_LEVEL = 3; // base → silver → gold → volt
export const SHARD_REFUND_PCT = 0.4; // refund when a duplicate is already maxed

export const UPGRADE_TIERS = ['', 'Silver', 'Gold', 'Volt'] as const;
