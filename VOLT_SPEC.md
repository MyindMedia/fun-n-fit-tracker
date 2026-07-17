# Volt System Spec (2026-07-16) — BO6-style Perks, Wildcards, Specialties, XP

Lawrence's directive: recreate the Call of Duty Black Ops 6 multiplayer
perk/wildcard/specialty system for Fun 'N Fit ("Volt System"), with perk
medallion cards, a COD-style player stats area on the profile, XP-gated
unlocks the kid swaps as they level, and timed XP boosts. Research sources:
SCUF BO6 perk/wildcard unlock table + Combat Specialty explainers (all three
equipped perks share a color → bonus specialty ability; wildcards are
rule-benders; Double XP tokens are timed).

## Mapping BO6 → Fun 'N Fit

| BO6 | Volt System |
|---|---|
| Player level (XP) | **Volt Level** from `students.totalXp` (dormant until now — accrual wired into applyPoints; one-time backfill = lifetime positive point earnings, so points already earned count: "a combo of XP + points") |
| Perk slots 1/2/3 | Perk rows HUSTLE / GAME / LEGEND, equip one per row, free to swap |
| Specialty colors (Enforcer red / Recon blue / Strategist green) | **STRIKER** volt #CBFE1C (game) / **SCOUT** cyan #2FA8FF (around town) / **CAPTAIN** violet #A78BFA (attendance + economy) |
| Combat Specialty (3 same color) | Specialty bonus: VOLT SURGE / TRAILBLAZER / TEAM CAPTAIN |
| Wildcards | 1 wildcard slot, 5 rule-benders (incl. Perk Greed = 4th flex perk) |
| Double XP tokens (timed) | XP tokens = ONE_SHOT gear items with `xpBoost` (2x/3x for a window), plus an admin `xp_multiplier` app setting for double-XP events |

Perks are free to equip once unlocked (no money anywhere near this system;
XP tokens cost points). All percentage effects flow through the SAME combined
factor as gear/boosts in applyPoints and respect the global clamp [0.5, 2.0].

## Levels

`VOLT_LEVELS` in voltCatalog.ts: 40 levels, threshold(n) = (n-1)*(25n+50)
(L2=100, L5=700, L10=2,700, L20=10,450 approx, L40≈41k). Level-ups fire an
activity log entry + big-board celebration.

## Perks (15 — key / name / specialty / unlock level / effect)

Row 1 HUSTLE: fast_start Fast Start STRIKER L1 {gamePct 5} · early_bird
Early Bird CAPTAIN L2 {checkinFlat 5} · trail_mix Trail Mix SCOUT L4
{earnPct 10} · warm_up Warm-Up STRIKER L7 {xpPct 10} · piggy_bank Piggy Bank
CAPTAIN L10 {shopDiscountPct 5}

Row 2 GAME: sharpshooter Sharpshooter STRIKER L3 {gamePct 10} · collector
Collector SCOUT L6 {crateCapPlus 1} · deal_maker Deal Maker CAPTAIN L9
{tradeSlotsPlus 2} · momentum Momentum STRIKER L13 {boostMinutesPlus 5} ·
bargain_hunter Bargain Hunter SCOUT L17 {shardRefundPct 60}

Row 3 LEGEND: finisher Finisher STRIKER L5 {xpPct 10} · town_hero Town Hero
SCOUT L8 {earnPct 15} · bankroll Bankroll CAPTAIN L11 {checkinFlat 10} ·
iron_will Iron Will CAPTAIN L15 {demotionShield} · overtime Overtime STRIKER
L19 {gamePct 5, xpPct 5}

Specialty bonuses (all 3 rows same specialty): STRIKER "VOLT SURGE"
{gamePct 5, xpPct 5} · SCOUT "TRAILBLAZER" {earnPct 10} · CAPTAIN
"TEAM CAPTAIN" {checkinFlat 5, shopDiscountPct 5}

## Wildcards (equip one)

marathon Marathon L12 (boosts/XP tokens run 25 min base) · double_down
Double Down L16 (two active boosts at once) · high_roller High Roller L21
{crateCapPlus 2} · perk_greed Perk Greed L26 (4th flex perk, any row) ·
xp_tycoon XP Tycoon L32 {xpPct 25}

## XP accrual + boosts

- applyPoints: qualifying positive sources (MANUAL, CHECKIN, PARTNER_VISIT,
  SPECIAL_TASK, FIT, JACKPOT) grant XP = round(finalPoints × xpFactor).
  xpFactor = 1 + perk/specialty/wildcard xpPct + active XP-token boost
  + (xp_multiplier app setting − 1). Capped at 4x. xpTransactions row +
  totalXp patch + level-up celebration in the same mutation.
- XP tokens in gearCatalog (wave 4): xp_spark "XP Spark" ONE_SHOT 150 pts
  (xpBoost +1.0 = 2x) · xp_storm "XP Storm" ONE_SHOT 300 pts (xpBoost +2.0 =
  3x). Bought/activated through the existing gear machinery; jackpot gets a
  GEAR_ITEM prize kind so the wheel can drop XP Sparks.
- Spends/refunds/SYSTEM never grant XP; XP never decreases.

## Player stats area (COD-style, Profile tab)

VoltStatsCard at the top of the profile display view: level hexagon + XP bar
to next level, equipped medallion row (perk 1/2/3 + wildcard + flex), tap →
VoltLoadout full-screen. Stats grid from volt:profile (lifetime points,
medals, crates, trades done, check-ins, partner visits, band taps, current
points). VoltLoadout mirrors the BO6 image: three labeled rows of hex
medallions ("EQUIP ONE"), specialty medallion that lights when all three
match, wildcard row, locked medallions dimmed with "LVL n" tags.
VoltMedallion = code-drawn SVG hexagon (specialty rim, engraved Ic icon,
BO6-style name bar), same zero-asset philosophy as the avatar rig.

## Ownership

- Integrator (me): voltCatalog.ts, convex/schema.ts (students.voltLoadout,
  jackpotPrizes kind + GEAR_ITEM), convex/volt.ts, hooks in convex/helpers.ts
  / gear.ts / lootBoxes.ts / trades.ts / jackpot.ts / students.ts,
  gearCatalog.ts XP tokens, BoostControl xp_multiplier toggle, deploy/backfill.
- UI agent: components/volt/VoltMedallion.tsx + VoltLoadout.tsx +
  VoltStatsCard.tsx, services/voltClient.ts, StudentPortal.tsx (Profile tab
  mount only), components/Student/PlayerCard.tsx (medallion mini-row).
