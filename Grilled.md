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
