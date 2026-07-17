# Economy Wave Spec (2026-07-16) — FitTokens, Consumable Loadouts, Trading Rules, Pause/Resume, Point Comments, Jackpot, In-Kind Marketplace

Authoritative spec for the fifth /goal directive. Written autonomously; defaults are
flagged and mirrored in Grilled.md. Build on the existing Convex prod deployment
`dependable-spoonbill-535`. All new point movement goes through `applyPoints`
(convex/helpers.ts). No em dashes in UI copy.

## Hard rules (apply to every workstream)

1. **Kid safety / compliance (locked by compliance review):**
   - Card data NEVER touches this codebase. Payments happen only on external
     hosted checkout pages (Stripe Payment Link / GoHighLevel checkout) reached
     by full redirect from the PARENT portal. We store pack, amount label,
     status, reference code, parent email. Never a PAN, never a CVV, no card
     fields, no payment iframes on our domain (SAQ A posture).
   - The student portal NEVER shows dollar prices, payment links, or any
     purchase-money surface. Kids see FitTokens only as a fun currency.
   - Real money buys COSMETICS ONLY (avatar vanity items). FitTokens can never
     buy gear, boosts, points, or anything that affects scoring. No pay-to-win.
2. **No git operations by agents.** No commit, stash, branch, push. Ever.
3. **No `npx convex deploy` / `npx convex run` by agents** — the integrator
   deploys schema + functions and runs seeds after merge.
4. **File ownership matrix is binding** (see bottom). If you need a change in a
   file you don't own, write a `// INTEGRATION:` comment in your own file and
   note it in your final report instead of editing.
5. `npx tsc --noEmit` has 21 pre-existing errors in old components. You may not
   add ANY new ones. `npm run build` (vite) must stay green.
6. Follow existing idioms: catalog files shared client+Convex by root import,
   activity via `logActivity`, board celebrations via `publishEvent` with the
   existing payload shapes, admin trust model is client-side gating, parent
   actions authed with `requireParent`/`requireParentLink`, dates via
   `resolveLocalDate`, tokens via `randomToken`.

## 1. FitTokens — parent-paid cosmetic currency

**Schema (already added by foundation):** `students.fitTokens?: number`
(denormalized balance), `fitTokenPacks`, `fitTokenPurchases`, `fitTokenLedger`.

- **Packs** (`fitTokenPacks`): key, name, tokens, priceLabel (display string,
  e.g. "$4.99"), paymentUrl (optional; the hosted checkout link), sort, active.
  Admin CRUD in Token Center. Seed defaults (idempotent internal mutation in
  convex/fitTokens.ts, upsert by key): starter 50 tokens "$4.99", player 120
  "$9.99", pro 300 "$19.99", all with paymentUrl "" (empty → parent UI shows
  "pay at the front desk" copy instead of a Pay button).
- **Purchase intent flow (parent portal):** parent picks a linked athlete +
  pack → `fitTokens.startPurchase` creates `fitTokenPurchases` row
  { parentId, studentId, packKey, tokens, reference: "FT-" + 6 hex chars
  uppercase, status: "PENDING" } and returns it. UI shows the reference code
  prominently ("give this code at the desk" / it also rides the payment link)
  and, when the pack has a paymentUrl, a "Pay now" button opening
  `paymentUrl + (includes "?" ? "&" : "?") + "client_reference_id=" + reference`
  in a new tab. Pending purchases listed with status chips; parent can cancel
  a PENDING intent.
- **Crediting** (both paths idempotent — a CREDITED purchase never credits twice):
  - Webhook: `POST /fittoken-purchase` on the convex.site HTTP router, header
    `x-fittoken-secret` must equal env `FITTOKEN_WEBHOOK_SECRET` (401 otherwise).
    Body: `{ reference }` OR `{ email, packKey }` (matches the newest PENDING
    intent for that parent email + pack). On match: mark CREDITED
    (creditedBy: "WEBHOOK"), bump student balance, insert ledger row, notify
    activity feed ("FitTokens added"). Response reports matched/credited or
    a clear miss reason. Mirror the /parent-invite handler's style.
  - Admin: Token Center lists PENDING intents (parent, kid, pack, reference,
    age) with Credit and Cancel buttons; Credit stamps the admin name.
- **Manual grant/adjust:** `fitTokens.adjust` (admin): studentId, delta
  (+/-), reason. Never lets balance go below 0. Ledger row kind "ADJUST".
- **Ledger** (`fitTokenLedger`): studentId, amount (+/-), kind
  PURCHASE | ADJUST | SPEND | JACKPOT, description, byName, createdAt. The
  balance on students is always patched in the same mutation as the ledger
  insert.
- **Spending — vanity only:** `fitTokens.buyAvatarItem` (called from the
  student portal Avatar Studio, and from nowhere else): validates the item
  exists, has a `tokenPrice`, isn't owned, balance covers it → inserts
  `studentWearables` row, decrements balance, ledger SPEND, auto-equips into
  `avatarLook` (same behavior as the existing point purchase), activity log.
- **avatarCatalog token prices** (agent A assigns values on the existing
  items; the `tokenPrice?: number` field is already in the type): every
  non-default item gets one — common 10, uncommon 25, legendary 60. Points
  purchase stays as-is; tokens are an alternate way to pay, shown as a second
  price tag in the Studio when the kid has tokens.
- **UI:**
  - Parent portal: a "FitTokens" card per linked athlete (balance + Get More)
    and a Get FitTokens sheet (pack list → intent → pay/desk instructions +
    pending list). Owner: agent A (parent dashboard + student portal shell).
  - Student portal: token balance chip next to points in the portal header
    (volt-styled, coin icon). Studio item cards show the token price tag and
    a "Use FitTokens" buy path when affordable.
  - Admin Token Center (More menu, stub exists): pending queue, pack CRUD,
    per-student balance list + adjust.

## 2. Consumable loadouts (gear usage classes)

**Schema:** `gearActivations` table (foundation): studentId, gearKey, kind
DAILY | ONE_SHOT, date (YYYY-MM-DD local), activatedAt, expiresAt.
Indexes: by_student_date, by_student.

**Catalog type** (already in gearCatalog.ts): `usage?: 'PASSIVE' | 'DAILY' |
'ONE_SHOT'` (undefined = PASSIVE = always-on equipped slot, current behavior),
`durationMin?: number` (default 15), `tradable?: boolean`.

- **DAILY**: activate once per calendar day per item; the effect lasts
  durationMin minutes; after use it cools down until midnight ("Used today").
  Item stays owned.
- **ONE_SHOT**: single use — activating consumes the studentGear row (it's
  gone; re-earn or re-buy). Strongest effects live here.
- **Activation rules (server, convex/gear.ts `activate`):** must own the item;
  usage must be DAILY/ONE_SHOT; only ONE live activation per student at a time
  (reject with a friendly error while one is running); DAILY: reject if an
  activation row for that item+date exists. ONE_SHOT: delete the studentGear
  row in the same mutation. Log activity ("activated Golden Ticket").
- **applyPoints hook (agent B owns convex/helpers.ts):** after the passive
  gear factor, look up a live activation (expiresAt > now) for the student;
  multiply its factor for the matching source; the COMBINED gear+boost factor
  stays clamped to [0.5, 2.0]; description gets "(boost +40%)" style suffix.
  Also add "JACKPOT" to the multiplier/gear exclusion list (gift credits are
  never amplified), matching how SYSTEM is excluded.
- **New consumable items (agent B adds ~6 to gearCatalog wave 3, points
  prices, icons: reuse existing /assets/gear/*.png icons — do NOT invent new
  asset paths):** suggested set: 3 DAILY (e.g. +40% game 15min at 300 pts,
  +50% earn 15min at 300 pts, +25% all 15min at 400 pts) and 2-3 ONE_SHOT
  (e.g. +100% game 15min at 500 pts, +75% game/+25% earn 15min at 600 pts,
  one earnable via unlock). Consumables have NO downsides (they cost and
  vanish instead).
- **UI (GearShop.tsx, agent B):** loadout panel gains a Consumables section:
  owned consumables with Activate button, live countdown while running,
  "Used today" cooldown state, "single use" label on one-shots; shop cards
  for consumables show usage class clearly.

## 3. Trading rules (avatar + loadout items alike, with abuse guards)

- trades.ts adds kind **GEAR** alongside BADGE/ITEM. Ownership = studentGear
  rows; transfer moves the row (acquiredVia travels); if the giver had it
  equipped, clear `students.gearEquipped` to null.
- **Tradability is enforced server-side in assertKindKey/tradable query:**
  - Avatar ITEM: tradable unless `isDefault` or `tradable === false` in the
    catalog. Agent A sets `tradable: false` on all legendary avatar items.
  - GEAR: tradable ONLY if `tradable === true` in the catalog. Agent B marks
    PASSIVE rank C and B items WITHOUT an unlock as tradable: true; everything
    else (rank A/S, anything with an unlock, all consumables) stays
    non-tradable — achievements stay earned, power stays capped.
  - BADGE: unchanged.
- 5-open-offer cap and both-sides revalidation stay as-is.
- **UI (agent B):** PlayerCard trade builder gets a Gear section on both
  sides; non-tradable things render with a lock and a one-line reason.

## 4. Game pause / resume (coach control)

- **Schema (foundation):** gameSessions gains `pausedAt?: number | null`,
  `pausedMs?: number`.
- convex/games.ts: `pause` (sets pausedAt if active+unpaused),
  `resume` (pausedMs += now - pausedAt; pausedAt = null), publishEvent
  "game_pause"/"game_resume" with { sessionId, title }. `end` works from
  paused state too (fold outstanding pausedAt into pausedMs first).
- Timers: any countdown/elapsed math must freeze while paused and subtract
  pausedMs when running (DrillLauncher scoreboard, live board).
- nfc autoScan (convex/nfc.ts): a paused session is NOT a scan target — if
  the kid's only live session is paused, return { status: "game_paused",
  message } so the admin toast says the game is paused (kid presence already
  guaranteed upstream; do not double check-in).
- UI: DrillLauncher in-game controls show Pause/Resume next to End; live
  board shows a PAUSED chip on the active-game banner.

## 5. Manual point awards carry a comment

- The admin manual award surfaces (quick award buttons / one-hand scorer /
  student modal point adjust) gain a reason: quick-pick chips (Hustle,
  Teamwork, Effort, Listening, Leadership, Helping out, Game winner) + free
  text. The chosen reason becomes the transaction description
  ("Coach award: Hustle"). Server mutations already accept description —
  thread it through everywhere a manual MANUAL-source award happens. Default
  if the coach types nothing: "Coach award". Reason shows in Activity Log
  (it already renders description + "by <coach>").

## 6. Jackpot — random gift for a selected kid

- **Schema (foundation):** `jackpotPrizes` (key, label, kind, value, weight,
  active), `jackpotSpins` (studentId, prizeKey, label, byAdmin, createdAt).
- Prize kinds: `POINTS` (value = amount, credited via applyPoints with
  sourceType "JACKPOT" so it's excluded from multipliers/gear),
  `TOKENS` (value = FitTokens amount; ledger kind JACKPOT — the one free
  token faucet, keep amounts small), `AVATAR_ITEM` (value = rarity; server
  picks a random unowned item of that rarity; if the kid owns them all,
  fall back to POINTS 50).
- convex/jackpot.ts: `spin` mutation (admin): studentId → weighted server-side
  pick over active prizes → fulfill in the same mutation → insert jackpotSpins
  row → logActivity + publishEvent celebration (reuse the "rank_up" kind with
  payload.type BADGE_EARNED pattern, message "JACKPOT! <kid> won <label>") →
  return the prize so the wheel can land on it. Seed (internal, idempotent):
  25 pts w40, 50 pts w25, 100 pts w12, 5 FitTokens w10, uncommon avatar item
  w9, legendary avatar item w3, 250 pts w1.
- Admin UI (Jackpot stub, agent D): pick a kid (roster picker, or Random
  present kid button) → big wheel animation (CSS/SVG, volt style, segments
  from active prizes) → server spin first, then animate landing on the
  returned prize → celebration + result card. Prize pool editor (CRUD +
  weights + active toggles) below.

## 7. Points Marketplace — in-kind donations with confirmed redemption

- **Schema (foundation):** `marketItems` (name, description, icon (emoji-free
  string key for DataIcon or short label), imageUrl?, pointCost, qtyAvailable,
  donatedBy?, active, createdAt), `marketOrders` (studentId, itemId, itemName,
  cost, claimCode, status PENDING | FULFILLED | CANCELLED, requestedVia,
  confirmedBy?, createdAt, resolvedAt?).
- convex/market.ts:
  - admin CRUD: create/update/archive items (qty editable; active toggle).
  - `redeem` (student portal): item active + qtyAvailable > 0 + kid affords →
    decrement qty, deduct points via applyPoints (negative, sourceType
    "REDEMPTION", description "Marketplace: <item>"), create order with
    claimCode = 6-char uppercase from randomToken, log activity. Returns the
    order (kid sees the claim code).
  - `cancel` (admin or the kid while PENDING): restore qty, refund points
    (positive REDEMPTION "Marketplace refund: <item>"), status CANCELLED.
  - `confirm` (admin): PENDING → FULFILLED, stamps confirmedBy + resolvedAt.
    THIS is the required confirmation step: the family shows the claim code
    at the desk, staff matches it in the queue and confirms the handover.
  - queries: activeItems (student), myOrders (student), adminQueue (orders +
    item + student join), adminItems.
- Seed (internal, idempotent by name): "Angels Game Tickets (Pair)" — donated
  by a community sponsor, 2000 pts, qty 2, active, description invites the
  family to pick up at the front desk. (Lawrence adjusts price/qty in admin.)
- **UI:** Student portal Marketplace tab (stub exists): prize-shelf cards
  (image/icon, name, donated-by line, point price, qty left), redeem confirm
  dialog ("This spends 2,000 points. Pick up at the front desk with your
  code."), My Orders list with claim code + status chips. Admin Marketplace
  page (stub exists): item CRUD + order queue with Confirm / Cancel.

## 8. File ownership matrix (binding)

Foundation (already done when agents start): convex/schema.ts, types.ts,
catalog TYPE fields in gearCatalog.ts + avatarCatalog.ts, stub components +
tab/menu registration, this spec, Grilled.md.

- **Agent A (FitTokens):** convex/fitTokens.ts (placeholder exists — replace),
  convex/http.ts, avatarCatalog.ts (assign tokenPrice + tradable:false values
  ONLY — types already exist), services/fitTokensClient.ts (new, follow
  services/gameCenter.ts singleton pattern), components/ParentDashboard.tsx,
  components/avatar/AvatarStudio.tsx (token buy path + kid-facing token
  balance), components/Admin/TokenCenter.tsx (stub exists — fill it).
- **Agent B (loadouts + trading):** gearCatalog.ts (new consumable items +
  tradable flags — types already exist), convex/gear.ts, convex/helpers.ts
  (applyPoints activation hook + JACKPOT exclusion), convex/trades.ts,
  services/loadoutClient.ts (new), components/avatar/GearShop.tsx,
  components/Student/PlayerCard.tsx, components/StudentPortal.tsx (trade
  inbox rendering in renderFriendsTab ONLY — do not touch the tab registry).
- **Agent C (coach controls):** convex/games.ts, convex/nfc.ts,
  convex/points.ts (only if needed), services/backend.ts (ONLY to add
  pauseGame/resumeGame client methods — doc mappers already pass
  pausedAt/pausedMs), components/Admin/DrillLauncher.tsx,
  components/Admin/OneHandScorer.tsx, components/Admin/BatchAwardForm.tsx,
  components/Admin/BulkAwardForm.tsx, components/Admin/EditAthleteModal.tsx,
  components/Leaderboard.tsx.
- **Agent D (jackpot + marketplace):** convex/jackpot.ts + convex/market.ts
  (placeholders exist — replace), services/marketClient.ts (new),
  components/Admin/JackpotPanel.tsx, components/Admin/MarketplaceManager.tsx,
  components/Student/MarketplaceTab.tsx (stubs exist — fill them).

Frozen for everyone: services/gameCenter.ts, services/backend.ts (except
agent C's two methods), convex/seed.ts, convex/schema.ts, types.ts,
constants.ts, index.html, App.tsx, components/AdminDashboard.tsx, and
components/StudentPortal.tsx (except agent B's Friends-tab scope). Convex
codegen already ran with the new modules registered — do NOT run `npx convex
codegen`, `npx convex deploy`, or `npx convex run`. If blocked on a frozen
file, leave an `// INTEGRATION:` comment in your own file and report it.
