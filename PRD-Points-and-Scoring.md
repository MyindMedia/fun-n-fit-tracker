# Fun N' Fit Tracker — Points, Scoring, and Data PRD

## Overview
- Purpose: Real-time fitness game platform with house competition, session scoring, and player progression.
- Scope: Data schema, scoring flows, session lifecycle, notifications, and leaderboard behavior.

## Objectives
- Provide an auditable points ledger and rank progression.
- Enable coaches to run timed sessions with house/MVP results.
- Ensure live visibility: bubbles, sounds, countdowns, timer, and winner/MVP modal.

## Core Data Model
- `students`
  - Identity: `id` (UUID), `fullName`, `gender`, `avatarUrl`
  - House & presence: `houseId` in {UNITY,SAGE,SPARK,VALOR}, `isPresent`
  - Progression: `points` (int), `rankId` (string), `badges` (text[]), `inventory` (text[])
  - Timestamps: `createdAt`
- `ranks`
  - Progression levels: `id`, `name`, `threshold`, `icon`, `color`, `description`
- `badges`
  - Achievements: `id`, `name`, `icon`, `description`, `color`
- `rewards`
  - Redeemables: `id`, `name`, `cost`, `icon`, `category` in {Virtual, Real}, `description`
- `notifications`
  - Activity stream: `id`, `type` in {POINTS,RANK_UP,GAME_END,ENROLL,BADGE_EARNED,REWARD_CLAIMED}
  - Context: `studentId`, `studentName`, `avatarUrl`, `houseId`, `message`, `amount`, `adminName`
  - Time: `timestamp` (bigint), `createdAt`
- `transactions`
  - Points ledger: `id`, `studentId` (FK), `amount` (signed), `sourceType` in {MANUAL,FIT,REDEMPTION}, `description`, `createdAt`
- `game_sessions`
  - Session: `id`, `gameKey`, `title`, `startTime` (ms), `endTime` (ms), `isActive` (bool), `startedBy`, `roster` (text[] of student ids)
  - `results` JSONB: `{ winningHouseId, winningHouseScore, mvpStudentId, mvpStudentScore, outs }`
- `game_library`
  - Drill definitions and defaults: `game_key`, `display_name`, `duration_default_seconds`, `template_id`, etc.
- `app_settings`, `drill_presets`
  - Config and saved launches.

## Scoring System
- Point sources
  - Manual award/deduct: coach-driven; writes to `transactions` and updates `students.points`.
  - House bonus/deduction: applies per-student in the roster for selected house; individual `transactions` per student.
  - Redemption: subtracts points for rewards; writes to `transactions` and student `inventory`.
  - System demotion penalty: when deduction would cross below prior rank threshold, apply `-10` penalty.
- Rank progression
  - On any points change, recompute `rankId` from `ranks.threshold`.
  - Rank-up logs `RANK_UP` in `notifications` and broadcasts celebration.
  - Demotion logs `RANK_DOWN` and applies penalty transaction when applicable.
- Lap/time trials
  - Lap button records lap time via `notifications` type `LAP_TIME`; does not award points during the session.
  - Optional badge for fast laps may be granted (e.g., `speed_demon`).
- Bulk awards after session
  - After `game_end`, open bulk award modal; coach can award or deduct points to individuals or whole house.

## Session Lifecycle and Results
- Start
  - Coach launches session: creates `game_sessions` row and broadcasts `game_start`.
  - Live overlay shows title, then 3-2-1-Go with start sound.
- During play
  - Final alerts: 30s beep + banner, 10s numeric countdown + audio.
  - Player OUT status is tracked per session in `results.outs`.
- End
  - Stopping a session sets `isActive=false`, writes `results`, and logs `GAME_END`.
  - Results calculation: sum `transactions.amount` in `[startTime,endTime]` for roster:
    - House score = sum by `houseId`.
    - MVP = student with highest sum.
  - Live overlay sequence:
    - Game Over flash + `game-over-Logo.wav`.
    - Winner/MVP modal: large winning team icon and name; MVP photo + name + rank; confetti and shimmer; winner audio.

## Live Visibility and Feedback
- Point bubbles
  - Render green/red bubbles with `+/-` amount and description on Live/projector.
  - Triggered by `notifications` POINTS or `transactions` insert events.
- Sounds
  - Always enabled; audio context resumes automatically.
  - Start sound at “3”, final 10s sound, game-over logo sound, winner fanfare, award/loss sounds, rank-up/level-up.
- Timers
  - Current game timer card shows title and remaining time; pulses near 30s/10s.
- Activity ticker
  - Bottom marquee shows POINTS/RANK_UP/BADGE_EARNED/GAME_END entries with highlights for recent events.

## Coach Tools
- Manual scorer
  - Templates: Rep Counter, Accuracy, Time Trial.
  - Time Trial “Lap” records lap time only; roster rows show current points.
- Bulk award
  - Award/deduct to selection or whole house; validates inputs; writes transactions and notifications.
- Attendance
  - Toggle present/absent, daily reset utility.

## Policies & Auditing
- Immutable ledger: all point changes recorded in `transactions`.
- Notifications are the UI activity stream; not authoritative for totals.
- Indexes on students, sessions, transactions, notifications support live updates.
- RLS is intended for production; demo/dev may allow public reads.

## Edge Cases
- Rank demotion: deduction may trigger penalty; points floored at 0.
- Undo last score: finds most recent `transactions` row and applies inverse amount.
- Missing notifications: bubbles also listen to `transactions` realtime to ensure visibility.

## Asset/Sound Map
- Bucket: `Assets` (public)
- Key assets:
  - Start: `audio_files/game-start/game-start.wav`
  - Final countdown: `audio_files/game-over-countdown/game-over-countdown.wav`
  - Game over: `audio_files/game-over-screen/game-over-Logo.wav`
  - Winner: `audio_files/game-winner/game-winner.wav`
  - Award: `audio_files/point-sparkle/*`
  - Deduct: `audio_files/point-lost/lose-points.wav`

## Non-Functional Requirements
- Real-time consistency across devices (Supabase broadcast + local cross-tab sync + periodic polling backstop).
- High-visibility UI overlays with z-index ordering so bubbles, timer, and winner modal are unobstructed.
- Audio should not require manual enable; context resumes programmatically.

## Open Questions / Future Enhancements
- Configurable demotion penalty size per rank.
- Per-game scoring multipliers or modifiers.
- Advanced achievements based on lap distribution or streaks.
- Server-enforced RLS and role-based actions for coach/admin.
