# Game Center Expansion — Spec

Written 2026-07-15 from Lawrence's /goal directive. Extends the existing Convex app
(see `Grilled.md`) into a full game center: parent-driven QR/NFC check-in, a live
"who's here today" board, staff↔parent messaging, point earning at partner businesses
and via off-site special tasks, and a Rocket League-style perk/skin redemption economy.

## 1. Dynamic check-in (QR primary, NFC optional)

**Flow:** The admin dashboard's Check-In Board displays a **rotating QR code**
(fresh token every 60s, 90s TTL). A parent opens the parent portal on their phone,
taps **Check In**, scans the front-desk QR (or the QR encodes a deep link
`#/parent-dashboard?checkin=<token>` so the native camera app works too), picks which
of their linked kids are here, and confirms. The kids instantly appear on the board —
"on the board for the day and ready to play."

- `checkinTokens` table: `{ token, kind: "FRONT_DESK" | "NFC_KIOSK", expiresAt, createdAt }`.
  FRONT_DESK tokens are single-day rotating; NFC_KIOSK is a long-lived secret written to a
  physical NFC tag (rotatable from the admin dashboard). Web NFC (Android Chrome) reads the
  tag in the parent portal; QR is the universal path.
- `checkIns` table: `{ studentId, date "YYYY-MM-DD", checkedInAt, checkedOutAt?, method
  "QR"|"NFC"|"MANUAL", byParentId?, byAdminName? }` — one row per student per day (idempotent).
- Check-in sets `students.isPresent = true`, logs an activity notification, publishes a
  celebration event, and awards a **daily check-in bonus (+10 pts, sourceType CHECKIN)**
  through the transactional `applyPoints` helper. Check-out clears `isPresent`.
- Admin board also supports manual check-in/out (upgrades the existing RollCallPanel
  presence toggle with a real attendance ledger).

## 2. Staff ↔ parent communications

- `conversations`: `{ parentId, subject?, lastMessageAt, lastMessagePreview,
  unreadForParent, unreadForStaff, createdAt }` (one default thread per parent; staff can
  start threads with any parent).
- `messages`: `{ conversationId, senderType "STAFF"|"PARENT", senderName, body, createdAt }`.
- Parent side authenticates with their session token; staff side operates from the admin
  dashboard (same trust model as every other admin function in the app).
- Unread badges on both dashboards; Convex subscriptions make it live.

## 3. Points economy (earn)

All awards flow through `applyPoints` (transactional, rank up/down, activity feed,
celebration events). New source types: `CHECKIN`, `PARTNER_VISIT`, `SPECIAL_TASK`.

**Partner businesses** (team adds later via admin CRUD):
- `partnerBusinesses`: `{ name, description?, category?, address?, pointsReward, qrSecret,
  isActive, createdAt }`. Admin prints each business's QR (deep link
  `#/parent-dashboard?visit=<qrSecret>`); the business posts it at their counter.
- `businessVisits`: `{ studentId, businessId, points, byParentId?, verifiedBy, date,
  createdAt }` — **max one visit per student per business per day** (anti-farming).
- Parent scans the business QR from the portal, picks kids, points award instantly.

**Special tasks** (off-site, when not at Fun N Fit):
- `specialTasks`: `{ title, description, points, isActive, requiresProof, createdAt }`.
- `taskSubmissions`: `{ taskId, studentId, byParentId, note?, photoUrl?, status
  PENDING|APPROVED|REJECTED, reviewedBy?, reviewedAt?, createdAt }`.
- Parent submits a completion (optional photo via Convex file storage); staff approve from
  the admin queue → points awarded on approval.

## 4. Perks & avatar skins (spend) — Rocket League style

- Existing `rewards` catalog stays the store backbone (points cost, Virtual/Real).
  New optional fields: `rarity` (common→legendary, drives card styling) and `value`
  (payload — e.g. an avatar-skin image URL).
- `redemptions` ledger: `{ studentId, rewardKey, rewardName, cost, status
  PENDING|FULFILLED|CANCELLED, requestedVia STUDENT|PARENT, fulfilledBy?, createdAt,
  fulfilledAt? }`.
- Redeeming deducts points transactionally (rejects insufficient balance). **Real** perks
  enter a PENDING fulfillment queue on the admin dashboard (cancel = refund). **Virtual**
  avatar skins auto-fulfill: the student's `avatarUrl` switches to the skin's `value` URL.
- Seed adds a rarity-tiered starter skin line (DiceBear art, zero custom assets needed)
  plus keeps existing rewards. The dormant `wearables` layered-avatar system stays as-is
  until art assets exist.

## 5. Surfaces

- **Admin dashboard** (new tabs): CHECK-IN (today board + rotating QR + manual controls +
  NFC secret management), MESSAGES (threads + unread), PARTNERS (CRUD + printable QR),
  TASKS (CRUD + approval queue), REDEMPTIONS (fulfillment queue).
- **Parent portal**: Check In (scan QR / NFC tap), Messages, Earn Around Town (partner
  directory + scan), Special Tasks (browse + submit), per-child stats now include check-in
  history, visits, redemptions. Multi-child selection everywhere.
- **Student portal**: Perk Shop (rarity-carded store + redeem + my redemptions),
  check-in streak in stats.

## 6. Non-goals / constraints

- No payments, no PHI. Kids' data surface unchanged (names/avatars/points already public
  on the leaderboard by design; new endpoints require parent session tokens for
  parent-initiated actions).
- Admin dashboard keeps its existing no-auth trust model (device-level security at the
  front desk) — matches every existing admin function; revisit later if needed.
- NFC is progressive enhancement (Android Chrome only); QR is the guaranteed path.
- No native app; PWA + responsive web as before.
