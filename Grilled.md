# Grilled.md — Fun 'N Fit Tracker

Alignment record for the Supabase → Convex migration. Written 2026-07-01 from a full code
survey plus Lawrence's explicit /goal directive (session ran autonomously, so open questions
were resolved with defaults noted below rather than interactive grilling).

## Goal
Replace Supabase (Postgres + Auth + Realtime + Storage) with **Convex** as the app's backend,
targeting the existing production deployment:

- Deployment: `dependable-spoonbill-535` (production, US East N. Virginia)
- Cloud URL: `https://dependable-spoonbill-535.convex.cloud`
- HTTP Actions URL: `https://dependable-spoonbill-535.convex.site`

All tables and relationships from the Supabase schema must exist in Convex. The Parent portal
and Student portal must keep working and be accessible from mobile.

## Target users
- **Coaches/Admins** — roster, scoring, drills, attendance (QR), branding, blog/alerts.
- **Students** — student portal: profile, gamer tag, friends, XP, store/wearables, challenges.
- **Parents** — parent portal: email/password account, linked athletes, enroll athlete,
  edit athlete profile/avatar, view points/rank/activity. Mobile-first.

## Stack
- Vite 6 + React 19 + react-router (HashRouter), Tailwind via CDN, Recharts, jsQR/qrcode.
- Backend: **Convex** (queries/mutations/actions, Convex file storage, reactive subscriptions
  replacing Supabase Realtime/broadcast channels).
- Deployed as static SPA (Netlify/Vercel configs exist in repo).

## Architecture decisions
1. **Service-layer swap, not a component rewrite.** ~30 components consume a single
   `supabaseService` singleton (methods + `.on(event, cb)` emitter). The Convex implementation
   lives in `services/backend.ts` and exposes the identical public API;
   `services/supabaseService.ts` becomes a re-export shim so components stay untouched.
2. **Realtime** — Convex `ConvexClient.onUpdate` subscriptions on students / notifications /
   active games replace `postgres_changes`; a small `appEvents` table replaces Supabase
   broadcast channels (rank-up celebrations, game start/end, live point bubbles).
3. **Parent auth** — Supabase Auth is replaced with a Convex-native email+password auth
   (`parents` + `parentSessions` tables, PBKDF2-hashed passwords via an action, bearer token in
   localStorage). No email-confirmation step (Supabase's confirm-email flow is dropped; default
   chosen for simplicity — revisit if abuse becomes a concern). Password reset is admin-assisted
   for now (no email provider is wired up).
4. **Point/rank logic moves server-side** into a transactional Convex mutation (`points.award`),
   fixing the Supabase read-modify-write race.
5. **Storage** — avatars/branding uploads use Convex file storage
   (`generateUploadUrl` → POST → serve URL), replacing the Supabase `Assets` bucket.
6. **Seed data** — ranks/badges/rewards/game library seeded from `constants.ts` via a seed
   mutation on deploy.

## Schema (Convex tables)
students, gameSessions, transactions, notifications, gameLibrary, badges, rewards, ranks,
trophies, appSettings, drillPresets, seasons, xpTransactions, wearables, studentWearables,
studentAvatars, tournaments, tournamentParticipants, tournamentMatches, challenges,
studentChallenges, blogPosts, parents, parentSessions, parentStudentLinks, appEvents.
Relationships enforced via `v.id(...)` references + indexes matching current query patterns
(students by house/points, transactions by student/createdAt, notifications by timestamp,
links by parent and by student, sessions by isActive).

## Non-goals
- No data migration from the old Supabase project (it held demo/dev data; production Convex
  deployment starts fresh with seeded catalog data).
- No component-level rewrite to Convex React hooks (future refactor).
- No native mobile app — mobile access is the responsive web app + PWA manifest.
- Existing `fun-n-fit-v2/` Next.js folder is out of scope (abandoned experiment).

## Constraints
- Kids' data (names, avatars, points) — keep the anon-readable surface minimal; parent-linked
  operations require a valid session token. No PHI/payments in scope.
- Keep bundle CDN-based Tailwind and HashRouter (Netlify/Vercel static hosting).

## Open questions (deferred, defaults applied)
- Should student list on the public login screen require a PIN/QR only? (Currently public by
  design, matching the existing app.)
- Email provider for parent password reset (currently admin-assisted).
- Whether to migrate any real data out of the old Supabase project.

---

# Game Center Expansion (2026-07-15)

Second /goal directive (session ran autonomously; gaps resolved with defaults noted in
`GAME_CENTER_SPEC.md`, the authoritative spec for this phase). Scope added on top of the
completed Convex migration:

1. **Dynamic check-in** — rotating QR on the admin Check-In Board (60s rotation, 90s TTL);
   parent scans from the parent portal to check in one or more linked kids; kids appear on
   the "today" board and get a +10 pt daily bonus. NFC tap = optional long-lived kiosk
   secret on a physical tag (Web NFC, Android Chrome), rotatable from admin. Manual
   check-in/out stays for staff.
2. **Staff↔parent messaging** — conversations + messages tables, live unread badges on
   both dashboards. Parent side requires session token; staff side uses the admin
   dashboard's existing trust model.
3. **Earning** — partner businesses (admin CRUD + printable QR, 1 visit/kid/business/day)
   and special tasks (parent submits completion, staff approves). All awards go through
   `applyPoints`. New source types: CHECKIN, PARTNER_VISIT, SPECIAL_TASK.
4. **Spending** — Rocket League-style perk shop on the existing rewards catalog (+ rarity
   + value fields), `redemptions` ledger, admin fulfillment queue for Real perks, instant
   auto-fulfill for Virtual avatar skins (DiceBear URLs — no art assets required).
   Wearables layered-avatar system stays dormant until art exists.
5. **Defaults chosen** (revisit anytime): +10 check-in bonus; admin dashboard stays
   unauthenticated (front-desk device trust); QR primary / NFC progressive enhancement;
   no payments/PHI anywhere in the new surface.

# Clerk authentication (2026-07-15)

- **Identity**: Clerk app "Fun N' Fit" (`app_3GZGTMK8INnd457uFoZ8xPWKLyx`, dev instance
  `wanted-chipmunk-37`). Parents sign in with email or Google via Clerk's hosted portal;
  `components/PortalGate.tsx` (route `/#/parent-login`, nav label **Portal**) exchanges the
  Clerk session for the app's own `parentSessions` token through
  `convex/clerkBridge.ts` (JWKS-verified JWT + Clerk Backend API email lookup), so every
  existing parent-scoped Convex function works unchanged. Parent rows are matched/created
  by email.
- **Roles**: admins = Clerk `publicMetadata.role === "admin"` OR email in
  `VITE_ADMIN_EMAILS` (defaults: lawrenceberment@gmail.com, info@myindmedia.org —
  `services/adminAccess.ts`). The Admin nav link renders only for admins; `/#/admin` is
  wrapped in an AdminGuard redirecting everyone else to the Portal; admins are routed to
  `/admin` immediately after login. Home + Live stay public. Convex admin *functions*
  remain unauthenticated server-side (unchanged trust model) — the gate is client-side.
- **Env**: `VITE_CLERK_PUBLISHABLE_KEY` required at build time (set in `.env.local`; must
  also be set in the Netlify/Vercel build env). Convex prod has `CLERK_SECRET_KEY` +
  `CLERK_JWT_ISSUER`. Legacy PBKDF2 sign-in code remains in `convex/parents.ts` but the UI
  now goes through Clerk only. Production Clerk instance not yet configured (dev keys).

# NFC tags & wristbands (2026-07-15)

Third /goal directive: USB NFC reader at the front desk + tags/wristbands per student.
Strategy of record: `NFC_STRATEGY.md`. Key decisions: keyboard-wedge USB readers (no
drivers, detected by typing-burst signature) + Web NFC on Android as the two input
paths; tag UIDs stored in the pre-existing `students.deviceId` field (uppercase hex,
unique across students, enforced server-side); all scan actions run through the same
check-in ledger / event bus as QR (`convex/nfc.ts`); admin "NFC Tags" sub-page carries
assign flows (scan-first and student-first), tag roster, fullscreen Check-In Mode, and
a Game/Timing mode built on `lap_time` scan events.

# Coach & rewards layer (2026-07-16)

Fourth /goal directive (Lawrence's feature list; session ran autonomously, defaults noted):

1. **Games** — Confirmed all requested games exist: Simon Says, Relay Races, Head Shoulder
   Cone, Marshmallow Toss (+3 variants), Dodgeball (+7 season variants). Added Zone Master
   (`ZONE_01`) and Tug of War (`TUG_01`). Library upserted on prod via `seed:refreshGames`.
2. **Coach attribution** — `transactions.adminName` persists who gave/took every point
   (daily coach login gate already existed). Activity Log shows "by <coach>" on entries.
3. **Medals / Session Legends** — `medals` table + `convex/medals.ts`
   (award/forStudent/recent/remove). Admin sub-page "Session Legends" (More menu): pick
   medal (Legend/MVP/Hustle/Teamwork/Sportsmanship/custom), pick kids, optional bonus
   points (default +25), optional shout-out note. Awards stamp the coach, log activity,
   and fire a big-board celebration ("Earned — Session Legend"). Medal removal does NOT
   claw back bonus points (default; revisit if abused).
4. **Superlatives in one place** — shared `TrophyCase` component: coach medals + badges +
   rewards. Student portal gets an "Awards" tab; parent detail view shows medals card;
   live board gets a "Legends Wall" (latest 6 medals).
5. **Level path** — shared `LevelPath` ladder (Noob → Apex) with achieved/current/next
   states and pts-to-go, shown in student Stats tab and parent detail view.
6. **Daily leaderboard** — `points.earnedBetween` aggregates the transactions ledger;
   live board gets Today / Week / Season toggle. "Reset each day" is natural midnight
   reset of the Today view; lifetime totals and full history stay in the ledger (any past
   range is queryable). No destructive reset by design.
7. **Point boost** — global `point_multiplier` app setting applied inside `applyPoints`
   to positive earnings only (spends/refunds stay 1:1); description gets "(2x)" suffix.
   Admin control in More menu (Off/1.5x/2x/3x), volt chip in admin header, "2x Points"
   banner on the live board.
8. **Display name preference** — `getStudentDisplayName` now honors
   `displayPreference` (FULL_NAME / GAMER_TAG / INITIALS); previously the gamer tag always
   won. Unset preference keeps legacy tag-first behavior. Applied on live board, portals,
   and parent cards.
9. **Avatar + loot boxes** — researched first (`AVATAR_RESEARCH.md`), then approved
   and built same day (see next section).

# Avatar system + loot crates (2026-07-16)

Lawrence approved the research direction with one steer: use the current design
aesthetic, multiple skin colors on a base silhouette, layered hair / clothes /
accessories / merch. Decisions:

1. **Art = code-drawn SVG rig** (`components/avatar/AvatarRig.tsx`), not AI raster
   layers — perfectly aligned layers, recolorable, crisp at any size, zero assets.
   Flat esports style matching the Pubzi theme (volt accents, notch motifs).
   6 skin tones, 8 hair colors (free pickers), 8 hairstyles, 9 tops (incl. 4 house
   jerseys as merch + legendary volt Champion Jacket), 9 accessories (incl.
   legendary Legend Crown). Registry: `avatarCatalog.ts` (shared client/Convex).
2. **Look storage** — denormalized on `students.avatarLook` (boards render without
   joins); `students.avatarMode: PHOTO | AVATAR` picks photo vs avatar everywhere
   `StudentAvatar` renders. Legacy `studentAvatars` table left dormant.
3. **Avatar Studio** (student portal, Profile + Store tabs) — character-select
   stage with CSS idle loop + spotlight + podium; skin/hair-color pickers; item
   grids with mini-rig previews; locked items buyable in place (existing
   `purchaseWearable`). Saving a look opts the kid into AVATAR mode; parents get a
   Photo/Avatar switch in their detail view too.
4. **Loot crates** (`convex/lootBoxes.ts`) — points-only, kid-safe by structure:
   odds printed on the crate and enforced server-side (Standard 100 pts:
   70/25/5; Premium 250 pts: 40/45/15), 3 opens/day cap, duplicates upgrade the
   item tier (base→Silver→Gold→Volt) and maxed duplicates refund 40% as shards —
   no dead rolls, no money path ever. New pulls auto-equip. Legendary pulls fire a
   big-board celebration. Ledger table `lootBoxOpens` (odds audit + cap).
5. **Multiplier guard** — SYSTEM source added to the point-boost exclusions so
   shard refunds can't be amplified.
6. Wearables catalog seeded via `seed:wearables` (26 items, upsert by key).

# Student self-login + profile polish (2026-07-16)

1. **Kid login, parent-granted** — `portalAccess` table (separate from students so
   the PIN never rides the public roster) + `convex/portalAccess.ts`
   (status/settings/setAccess/verify). Parent detail view gets a "Student Login"
   card: 4-digit PIN + ON/OFF. The kid goes to /#/login ("Players"), taps their
   name: disabled → locked notice pointing at the Parent Portal; enabled → PIN pad
   (server-side verify, activity-logged) → their portal (avatar studio, crates,
   perks). Default is OFF for every kid.
2. **Profile display cleanup** (Lawrence's screenshot): camera button and
   Photo/Avatar chips removed from the display view — the picture is clean; in
   Edit Profile, tapping the picture opens the camera/photo picker (volt camera
   badge shows the affordance) and the Photo vs Game Avatar choice lives in the
   edit form. Name and house chip no longer truncate ("BLOSSO…", "SPARK HOUS") —
   they wrap instead.

# Automatic NFC game capture (2026-07-16)

Lawrence's directive: NFC processing must be automatic per game — no opening the
NFC Bands page, no picking Timing/Points modes. Decisions:

1. **Game mode at launch** — NFC-capable games require a Manual / NFC Bands
   choice in the config screen before Start is enabled (in case bands aren't in
   play). Stored as `gameSessions.captureMode`; manual-only games skip the
   selector and default MANUAL.
2. **`nfc.autoScan` router** — the single tap entry point for every admin screen
   (wedge + desk agent). Presence first, then: live NFC-mode session containing
   the kid → the game definition decides (leaderboardMetric 'time' or
   nfc_split_ms/lap_time fields → splits/laps; otherwise +10 banked per tap);
   no session → plain door check-in. Toasts show lap · split, banked points, or
   check-in accordingly.
3. **Instructions rewritten** — all "Start NFC Timing mode…", "opens NFC Points
   mode…" steps removed from the game library (seeded) and the Rules & Guide
   NFC section now says: launch in NFC Bands mode, everything is automatic.
4. NFC Bands page remains for assigning wristbands and its manual modes still
   work when open, but gameplay no longer needs it. Verified on prod: timed game
   (lap 1 → split 1140ms), Gold Rush (+10/tap), no-game fallback to check-in.

# Gear system / Item Shop (2026-07-16)

Lawrence's directive: redesign the item shop into ranked power items ("Brawlhalla
meets Rocket League") that multiply points when worn — with names, ranks, perks
AND downsides — earnable via achievements or purchasable at premium prices.

1. **16 gear items** (`gearCatalog.ts`, icons from Lawrence's licensed Game
   Assets pack → public/assets/gear/): ranks C/B/A/S, each with source-specific
   effects — `game` (coach/game awards), `checkin` (daily bonus), `earn`
   (partner visits + tasks). Positive perks and negative downsides per item
   (e.g. Heat Streak: +35% game / −15% check-in / −10% earn). Gear factor per
   award clamped to [0.5, 2.0] — gear can at most double a score.
2. **One equipped slot** (`students.gearEquipped`); applyPoints multiplies
   positive earnings by the equipped gear's factor for that source and stamps
   the ledger description with "(gear +15%)" so every boost is auditable.
   Stacks with the global point boost.
3. **Dual acquisition** — achievement grind (CHECKINS / LAPS / MEDALS / CRATES /
   VISITS / LIFETIME_POINTS, live progress computed from the real ledgers,
   claim validates server-side) or direct buy at premium (200–1,500 pts).
   Buying/claiming auto-equips; claims fire a board celebration.
4. **Item Shop UI** (`GearShop.tsx`, top of the Store tab): loadout panel with
   live x-multipliers per source, rank-colored cards with ▲ green perks /
   ▼ red downsides, flavor lines, achievement progress bars with Claim buttons.
5. Verified on prod: +15% game boost (20→23), −5% check-in downside (20→19),
   claim gate rejection with progress, buy + auto-equip. KNOWN: big gear
   purchases can trip the pre-existing spend-demotion mechanic (open question
   from the migration phase).

# Player cards + trading (2026-07-16)

1. **Player cards** — kids tap any friend (Friends tab) or any Top 5 player /
   top scorer (Team tab) to inspect their card: avatar or photo, rank, points,
   equipped gear with its live perk/downside stats, badges, recent coach medals.
2. **Trading (friends only)** — badges and avatar items, both-sides consent:
   offer builder inside the player card (pick one thing from each side), Trades
   inbox on the Friends tab with Accept / Decline / Cancel. Server revalidates
   ownership at accept; upgrade tiers travel with items; a traded-away equipped
   item falls back to a starter piece; starter items and power GEAR are not
   tradable (achievements stay earned); 5 open offers max per kid.
3. Verified on prod end-to-end with a temporary QA student (created + deleted):
   propose → inbox → accept → inventories swapped.

# Parent invites (2026-07-16)

Invite links parents can sign up from, sendable by admins and by the GoHighLevel
automation after an enrollment purchase:

1. **Mechanics** — creating an invite PRE-creates the parent row (email-matched,
   same key clerkBridge uses) and links the athlete(s), then emails a branded
   invite (Resend) with `/#/parent-login?invite=<token>`. The link personalizes
   the sign-in gate ("You're invited — Sienna is already linked"); the email
   address does the actual linking, so the kid is on screen at first sign-in.
   Signing in flips the invite to ACCEPTED (clerkBridge hook).
2. **Admin UI** — Parent Accounts → "Invite Parent": name, email, athlete
   multi-select → sends the email + shows a copyable link (for texting);
   recent invites list with Pending / Signed up chips.
3. **GHL webhook** — `POST https://dependable-spoonbill-535.convex.site/parent-invite`
   with header `x-invite-secret` (INVITE_WEBHOOK_SECRET on the prod env) and JSON
   `{email, fullName, studentName}` (or studentNames[]). Students matched by
   exact full name; unmatched names returned in the response for front-desk
   follow-up. Wrong secret → 401.
4. Tables: `parentInvites` (by_token/by_email). Legacy "+ New Parent"
   password wizard kept as the secondary path.

# Parent guide page (2026-07-16)

Shareable branded walkthrough at `/#/parents` (`components/ParentGuide.tsx`,
standalone like Landing, "For Parents" nav link on the home page). Real
screenshots (public/assets/guide/) shot on prod with the QA parent account and
the QA athlete temporarily renamed "Jordan Miles" so no real kid appears on a
public page; portal-header bands cropped so the QA identity never shows.
Sections: live tracking, level path + medals, check-in, coach messaging, earn
around town, perk shop, kid corner (PIN login + Avatar Studio + crates,
points-only note), live board panorama, 3-step sign-up, contact. Screenshot
session was minted via a TEMPORARY convex mutation, deleted after the shoot.

# Economy wave (2026-07-16, fifth /goal directive)

Lawrence's feature list; session ran autonomously, defaults noted here, full spec in
`ECONOMY_SPEC.md`. Compliance review (compliance-ops, PCI lens) ran BEFORE build.

1. **FitTokens** — parent-paid cosmetic currency. Real payments happen ONLY on external
   hosted checkout pages (Stripe Payment Link / GHL checkout link, configured per pack in
   admin) reached from the PARENT portal; our code stores pack/reference/status, never card
   data (SAQ A posture). Crediting via `POST /fittoken-purchase` webhook
   (x-fittoken-secret, same pattern as /parent-invite — wire it to the GHL purchase
   automation) or admin confirmation in the new Token Center. Tokens buy VANITY ONLY
   (avatar items; token prices added across the catalog) — never gear, boosts, or points.
   Student portal shows no money surface anywhere (COPPA posture). Balance is
   per-student with a full ledger.
2. **Consumable loadouts** — gear gains usage classes: PASSIVE (current always-on slot),
   DAILY (activate once per day, 15-min effect, cools down till midnight), ONE_SHOT
   (strongest; consumed on use, re-earn or re-buy). One live activation at a time,
   enforced server-side in the same applyPoints path as passive gear; combined factor
   still clamped [0.5, 2.0]. Anti-abuse by design per Lawrence's directive.
3. **Trading** — extended to loadout GEAR alongside avatar items + badges, with per-item
   `tradable` flags: rank C/B non-achievement passives tradable; rank A/S, unlock-gated,
   and consumable gear non-tradable; legendary avatar items non-tradable; starters stay
   non-tradable. Enforced server-side.
4. **Game pause/resume** — gameSessions.pausedAt/pausedMs; Pause/Resume next to End in
   the coach controls; timers freeze; paused sessions are skipped by NFC autoScan; live
   board shows PAUSED.
5. **Manual point comments** — coach quick-award surfaces gain quick-pick reason chips +
   free text; reason lands in transactions.description ("Coach award: Hustle") and shows
   in the Activity Log with the existing "by <coach>" attribution.
6. **Jackpot** — admin picks a kid (or random present kid), volt prize wheel, server-side
   weighted pick from an editable prize pool (points / small FitToken drops / random
   avatar item), audited in jackpotSpins, big-board celebration. JACKPOT source excluded
   from multipliers/gear (gifts are never amplified).
7. **In-kind marketplace** — donated real-world prizes (seeded example: Angels Game
   Tickets pair) with point prices + limited quantity; kid redeems in a new Marketplace
   tab → points deducted, qty reserved, 6-char claim code issued; staff CONFIRMS the
   handover in the new admin Marketplace queue (or cancels → auto refund + qty restore).
8. Built by four parallel agents with a binding file-ownership matrix (spec §8);
   foundation (schema/types/stubs) laid single-author first to avoid collisions.
9. SHIPPED: commit 2f56b50 (07-16), Convex prod deployed, seeds run (3 packs /
   7 jackpot prizes / Angels tickets), smoke-tested live on prod: token
   grant→spend, consumable +40% boost math + re-activation guard, jackpot spin
   (Gold Chain granted), market redeem→claim code→cancel refund→qty restore,
   webhook 401 + miss-reason paths. FITTOKEN_WEBHOOK_SECRET set on Convex prod
   (value shared in the 07-16 chat; pack paymentUrls still empty — paste the
   GHL/Stripe hosted checkout links in Token Center when ready).

## Open questions from E2E verification (2026-07-15)
- **Spending can demote.** Ranks are computed from *current* points (pre-existing
  mechanic), so a big perk purchase that drops a kid below a rank threshold triggers the
  existing demotion + −20 penalty, and a staff refund restores the cost but not the
  penalty. Rocket League separates currency from rank; if that's wanted here, base rank
  on lifetime-earned points (sum of positive transactions or totalXp) instead — small
  server-side change in `applyPoints`, flag when ready.
- QA artifacts left on prod for demo purposes: parent account `qa-parent@funnfit.test`
  (password known to Lawrence; not committed here) linked to "UI Test Athlete", one
  message thread, one approved task submission, check-in + redemption history. The QA
  partner business was removed.
