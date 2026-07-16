# Avatar System & Loot Boxes — Research (2026-07-16)

Research-before-building for Lawrence's request: kids create an avatar with an
**animated character loop** (video-game character-select feel), collect and equip
**loot** (hats, scarfs, glasses, shirts, hair, colors), open **loot boxes** with
common / uncommon / legendary drops, choose **photo or avatar** in the portals, and
control whether their **gamer tag or real name** leads on the scoreboard.

---

## 1. What already exists in this codebase (more than expected)

| Piece | Status |
|---|---|
| `wearables` table (slots BASE_FACE / HAIRSTYLE / TOP / ACCESSORY, **rarity common→legendary**, xpCost, filePath) | Built, **dormant — zero art assets** |
| `studentWearables`, `studentAvatars` tables | Built, dormant |
| `AvatarCreator` (components/v2) — renders z-ordered image layers per slot | Built, dormant |
| Student portal "Store" tab — buys wearables by slot | Built, shows nothing (no art) |
| Perk shop + `redemptions` ledger + rarity styling | Live |
| DiceBear URL avatars (static SVG, auto-equip on redeem) | Live stopgap |
| Parent photo upload (`avatarUrl` via Convex storage) | Live |
| Gamer tag / real name / initials scoreboard toggle | **Shipped 2026-07-16** — `displayPreference` now honored everywhere |

The layered-avatar plumbing exists end to end. **The missing ingredient is art**,
plus the animation loop, the loot-box mechanic, and a photo/avatar switch.

## 2. Art system options

### A. Custom AI-generated layered pack (RECOMMENDED)
Generate our own base characters + item layers with the same Gemini image pipeline
that produced the house mascot logos and arena art. One "Fun N Fit hero" base body
(a few skin tones), then transparent-PNG item layers drawn on the same template:
hats, scarfs, glasses, shirts (house jerseys!), hairstyles, colorways.
- **Pros:** full ownership, on-brand (esports volt/dark), items can include house
  and academy-specific gear, unlimited future drops, zero license risk.
- **Cons:** needs one careful art session to lock a template so layers align
  (~40-60 images); regeneration discipline for consistency.
- Slots map 1:1 onto the existing `wearables` schema; files go in
  `public/assets/avatar/<slot>/`.

### B. DiceBear (current stopgap, extended)
[Adventurer style](https://www.dicebear.com/styles/adventurer/) supports options
(hair, glasses, earrings, colors) via URL params — could fake "items" by unlocking
option values. Art is [CC BY 4.0, code MIT](https://www.dicebear.com/licenses/).
- **Pros:** zero art effort, deterministic, already integrated.
- **Cons:** no real "collectible item" feel (options, not layered loot), no hats/
  scarfs/shirts in the style, no animation, generic look. Good fallback only.

### C. LPC animated pixel sprites
[Universal LPC Spritesheet Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)
composes genuinely **animated** (walk/idle) characters with clothing layers.
- **Pros:** real sprite animation, huge wardrobe, free.
- **Cons:** [CC-BY-SA 3.0 / GPL 3.0 licensing](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator)
  — share-alike + per-artist attribution obligations; retro pixel style clashes with
  the Pubzi esports brand. Not worth the license drag.

### D. Rive / Lottie rigged character
State-machine animation (blinking, idle sway, celebrate on rank-up).
- **Pros:** the most "video game" feel possible.
- **Cons:** authoring cost is high (rig + per-item meshes), new runtime dependency,
  every future item needs rig work. Overkill for v1.

### The character-select loop (applies to A, B, or D)
The "animated loop" doesn't need animated *art* — CSS does it convincingly:
layered avatar on a podium card with a slow **idle bob** (`translateY` keyframe),
breathing **scale** on the body layer, rotating **spotlight/glow** behind, floating
particles, and a **rarity-colored shine sweep**. The board already uses this trick
(`pz-float` on house logos). Instant, zero assets, GPU-cheap on iPads.

## 3. Loot box design (points-only, kid-safe)

Regulators and researchers treat loot boxes as gambling-adjacent **when real money
is involved** — e.g. Australia banned paid loot boxes for under-15s in 2024, and
studies document the dopamine-loop risk for kids
([The Conversation](https://theconversation.com/literally-just-child-gambling-what-kids-say-about-roblox-lootboxes-and-money-in-online-games-250387),
[Kidslox guide](https://kidslox.com/guide-to/loot-boxes/)). Our design stays firmly
on the safe side of that line, and should stay there permanently:

- **Points are earned by exercise only** — no real-money purchase path, ever.
- **Show exact odds on the box** before opening (e.g. 70% common / 25% uncommon /
  5% legendary) — transparency is the #1 recommended mitigation.
- **Daily cap** (e.g. 2 opens/day) — keeps it a treat, not a compulsion loop.
- **No duplicate dead-rolls:** a duplicate item auto-converts into **upgrade
  shards** for that item (this also delivers feature 8's "upgrading items" —
  upgrade levels add visual flair: bronze → silver → gold → volt glow border).
- **Server-side RNG** in a Convex mutation (`lootBoxes.open`): deducts cost via
  `applyPoints` (STORE_PURCHASE, multiplier-exempt), rolls rarity, grants the
  wearable, writes a `lootBoxOpens` ledger row, fires a board celebration.
- Suggested pricing vs. today's economy (+10 check-in, 10–100 per game, +25
  medals): **Standard box 100 pts**, **Premium box 250 pts** (better legendary odds).
- Opening animation: notched crate shakes → burst → item card flips in with
  rarity glow. All CSS/DOM, no new dependencies.

## 4. Photo vs avatar, and names

- Add `students.avatarMode: 'PHOTO' | 'AVATAR'` + keep both `photoUrl` (parent
  upload, today's `avatarUrl`) and the composed avatar. Boards and portals render
  whichever mode the family picked; kids without either keep DiceBear fallback.
- Compositing: render layers live (cheap) and cache a flattened PNG via canvas to
  Convex storage for QR passes/exports.
- **Name display: already shipped** — `displayPreference` (real name primary /
  gamer tag primary / initials) now controls every board and portal surface.

## 5. Recommended build plan (when approved)

1. **Art session** (one sitting): lock the base template, generate ~10 items per
   slot across rarities, resize + register in a `seed:wearables` catalog.
2. **Avatar Studio v2**: revive `AvatarCreator` with the new art, CSS
   character-select loop, equip/save via existing `studentWearables`.
3. **Loot boxes**: `convex/lootBoxes.ts` (open/history), odds display, daily cap,
   shard upgrades, opening animation, Legends-wall shoutout on legendary pulls.
4. **Photo/avatar toggle** in parent detail + student profile; flattened-PNG cache.
5. **Board integration**: avatar (or photo) + upgrade glow on Hall of Fame,
   celebrations, and the kiosk pass.

Estimated effort: one focused session for art + studio, one for loot boxes +
integration. No new runtime dependencies.

**Decision needed from Lawrence:** approve direction A (custom AI art pack on the
existing wearables system) or ask for a look-dev round of sample base characters
first.
