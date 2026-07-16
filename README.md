# Fun 'N Fit Tracker

Gamified fitness tracker for Fun 'N Fit Academy — live house leaderboard, coach/admin
dashboard, student portal, and a mobile-first parent portal.

**Backend: [Convex](https://convex.dev)** (production deployment `dependable-spoonbill-535`,
US East N. Virginia). The former Supabase backend has been fully migrated — database,
realtime, auth, and file storage all run on Convex now.

- Cloud URL: `https://dependable-spoonbill-535.convex.cloud`
- Dashboard: https://dashboard.convex.dev/t/myindmedia/fun-n-fit/dependable-spoonbill-535

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. `.env.local` needs:
   - `CONVEX_DEPLOYMENT=prod:dependable-spoonbill-535` (used by the Convex CLI)
   - `VITE_CONVEX_URL=https://dependable-spoonbill-535.convex.cloud`
   - `VITE_API_KEY=<Gemini key>` (optional, Coach Pep Talk feature)
3. Run the app: `npm run dev`

## Backend development

Convex schema and functions live in `convex/`:

- `schema.ts` — all 35 tables + indexes (students, games, points ledger, notifications,
  catalog, tournaments, seasons, wearables, blog, parents/sessions/links, events bus,
  plus the game center: check-ins, messaging, partners, tasks, redemptions)
- `points.ts` — transactional point awards with rank promotion/demotion logic
- `parents.ts` — parent-portal auth (PBKDF2 email/password + session tokens) and
  parent↔student links
- `checkins.ts` — dynamic QR/NFC check-in (rotating front-desk tokens, today board,
  daily +10 bonus)
- `messaging.ts` — staff↔parent conversations with unread counts
- `partners.ts` — local partner businesses + QR-verified visits (1/kid/business/day)
- `specialTasks.ts` — off-site tasks, parent submissions, staff approval queue
- `redemptions.ts` — perk shop ledger (Real perks → fulfillment queue; Virtual avatar
  skins auto-apply)
- `seed.ts` — idempotent seeds: `npx convex run seed:catalog` and
  `npx convex run seed:gameCenter` (avatar skins + starter tasks)

Deploy backend changes with `npx convex deploy`. The client service layer is
`services/backend.ts` (re-exported as `supabaseService` for legacy imports),
`services/gameCenter.ts` (check-in / messaging / partners / tasks / redemptions),
and `services/parentAuth.ts`. Full game-center design: `GAME_CENTER_SPEC.md`.

## Portals

- `/#/live` — live leaderboard (projector-friendly)
- `/#/admin` — coach dashboard (roster, scoring, games, parent manager)
- `/#/login` — student portal
- `/#/parent-login` — parent portal (sign up / sign in; works on mobile, installable
  via PWA manifest)
