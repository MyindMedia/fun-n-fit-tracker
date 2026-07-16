# Fun 'N Fit Academy: Complete Gamification System Documentation

**Author:** Lawrence "ThaMyind" Berment - MyindSound
**Date:** December 27, 2025
**Version:** 1.0

---

## Executive Summary

This document presents a comprehensive gamification system designed for the Fun 'N Fit Academy. The system introduces a new **Experience Points (XP)** currency that operates alongside the existing **Points** system, creating a dual-currency model that rewards both competitive performance and long-term engagement. Drawing inspiration from successful gaming platforms like Rocket League and Fortnite, this design incorporates seasonal progression, tiered challenges, streak bonuses, and an in-app Academy Store to maximize student motivation and retention.

---

## Part 1: System Design Philosophy

### 1.1 The Dual-Currency Model

The cornerstone of this gamification system is the clear distinction between two types of currency: **Points** and **Experience Points (XP)**. This separation ensures that the competitive, real-time nature of the academy's sessions is preserved while also creating a parallel path for rewarding effort, consistency, and positive behavior.

**Points** serve as the competitive currency. They are earned and lost during game sessions, directly contributing to a student's House score and determining the session's MVP. This system remains largely unchanged from the current implementation. Points are volatile, meaning they can be deducted for poor sportsmanship or other infractions, and they reset in the context of each new competition.

**Experience Points (XP)**, in contrast, represent a student's cumulative journey through the academy. XP can only be earned and accumulated; it never decreases. This design choice is intentional, as it provides a sense of permanent progress and achievement. XP is earned through a diverse range of activities, from simply attending a session to completing weekly challenges or demonstrating exceptional leadership. This ensures that every student, regardless of their athletic ability, has a clear and achievable path to progression.

The following table summarizes the key differences between the two currencies:

| Attribute | Points | Experience Points (XP) |
| :--- | :--- | :--- |
| **Primary Purpose** | In-session competition and House rankings. | Long-term progression, rank advancement, and store purchases. |
| **Volatility** | Can be earned and deducted. | Can only be earned; never decreases (except for store purchases). |
| **Scope** | Session-specific; determines winners and MVPs. | Lifetime and seasonal; tracks overall engagement. |
| **Earning Methods** | Performance in games (speed, accuracy, wins). | Attendance, participation, challenges, streaks, coach awards. |
| **Contribution** | Individual points roll up to House totals. | Individual XP drives personal rank and Season Pass level. |

### 1.2 The Four Pillars of Engagement

This gamification system is built on four key pillars, each designed to address a different aspect of student motivation.

**Pillar 1: Progression.** Students need to feel a sense of forward momentum. The XP system, combined with the existing rank structure (Noob to Apex) and the new Season Pass, provides multiple layers of progression. As students earn XP, they see their lifetime total grow, their rank improve, and their Season Pass level increase, unlocking new rewards at each step.

**Pillar 2: Achievement.** Beyond simple progression, students are motivated by accomplishing specific goals. The challenge system provides a constant stream of achievable objectives, from simple daily tasks to ambitious seasonal milestones. Completing these challenges provides a sense of accomplishment and a tangible XP reward.

**Pillar 3: Social Connection.** The House system is a powerful tool for fostering community. By ensuring that individual XP contributions are visible within the context of the House, students are motivated not just for personal gain but also for the success of their team. Features like House-based seasonal challenges can further strengthen this bond.

**Pillar 4: Reward.** Ultimately, effort must be rewarded. The Academy Store provides a direct and tangible outlet for the XP that students earn. The ability to redeem XP for exclusive virtual items or real-world academy merchandise creates a powerful incentive loop that reinforces all other engagement activities.

---

## Part 2: The XP Earning Matrix

This section details the specific activities that will award XP and the proposed amounts for each. These values are designed to be balanced, ensuring that consistent participation is rewarded while still providing significant bonuses for exceptional achievements.

### 2.1 Session-Based XP Awards

These awards are tied directly to a student's participation in scheduled academy sessions.

| Activity | XP Award | Trigger |
| :--- | :--- | :--- |
| Session Attendance | 25 XP | Automatically awarded when a student is marked 'present' for a session. |
| Session Completion | 50 XP | Automatically awarded at the end of a session for all students who participated for the full duration. |
| Game Participation | 10 XP | Awarded for each individual game a student plays within a session. |
| Game Win (Individual/Team) | 25 XP | Awarded to the winning student or all members of the winning team for a specific game. |
| House Win Bonus | 15 XP | A bonus awarded to every member of the House that wins the overall session competition. |
| Session MVP | 50 XP | Awarded to the single student designated as the Most Valuable Player for the session. |

A student who attends a full session, participates in four games, wins two of them, and is on the winning House could earn a base of 25 + 50 + (4 * 10) + (2 * 25) + 15 = **180 XP** in a single session, not including any behavioral bonuses or challenge completions.

### 2.2 Behavioral and Effort-Based XP Awards

These awards are granted at the discretion of the coaching staff to reinforce the academy's core values, as outlined in the Team Playbook's Code of Conduct.

| Activity | XP Range | Description |
| :--- | :--- | :--- |
| Good Sportsmanship | 10-25 XP | Awarded for demonstrating fairness, respect, and a positive attitude, aligning with Code of Conduct rules 2 and 8. |
| Helping a Teammate | 15 XP | Awarded for actively assisting another student, reflecting the "Encourage, Don't Discourage" and "Stronger Together" values. |
| Demonstrating Leadership | 20 XP | Awarded for taking initiative, motivating others, or leading an activity, supporting the "Give Your Best Effort" value. |
| Exceptional Effort | 10-30 XP | Awarded for showing significant determination, regardless of the outcome, reflecting the "Stay Positive" value. |
| Custom Coach Award | 5-100 XP | A flexible award for any other positive action not covered above. Requires a reason and description for logging. |

### 2.3 Streak Bonuses

Streaks are a powerful gamification mechanic that rewards consistency. The system will track attendance streaks and award bonus XP upon reaching certain milestones.

| Streak Milestone | Bonus Reward | Description |
| :--- | :--- | :--- |
| 3-Day Attendance Streak | +25 XP | Awarded upon attending sessions on three consecutive scheduled days. |
| Weekly Perfect Attendance | +75 XP | Awarded for attending all scheduled sessions within a single calendar week. |
| Monthly Perfect Attendance | +300 XP | Awarded for attending all scheduled sessions within a calendar month. |
| Win Streak (3 Games) | 1.5x XP Multiplier | On the third consecutive game win and subsequent wins in the streak, the Game Win XP is multiplied by 1.5. |
| Win Streak (5 Games) | 2.0x XP Multiplier | On the fifth consecutive game win and beyond, the Game Win XP is doubled. |

### 2.4 Challenge-Based XP Awards

Challenges provide structured goals and are a key driver of engagement. The XP rewards scale with the difficulty and time commitment required.

| Challenge Type | Frequency | XP Range | Example Challenges |
| :--- | :--- | :--- | :--- |
| Daily | Resets every 24 hours | 25-50 XP | "Complete 3 games today." / "Give a high-five to a teammate." |
| Weekly | Resets every Monday | 100-250 XP | "Participate in 5 different types of drills this week." / "Be on the winning House at least twice." |
| Seasonal | Lasts the entire season | 500-1,000 XP | "Mentor a 'Noob' rank student for 3 sessions." / "Achieve a total of 5,000 session XP this season." |
| Milestone (One-Time) | Permanent | 50-500 XP | "Achieve your first game win." / "Attend your 50th session." / "Reach the 'Warrior' rank." |

---

## Part 3: Seasonal Structure and Progression

To maintain long-term engagement and provide a sense of recurring excitement, the academy will adopt a seasonal structure.

### 3.1 Season Definition

Each season will be a defined period, recommended to be approximately **12 weeks** in duration. This aligns well with typical school terms and provides a substantial but achievable timeframe for students to progress. Each season will have a unique name and theme (e.g., "Season 1: The Genesis," "Season 2: Rise of the Champions") to create a sense of narrative and anticipation.

### 3.2 The Season Pass

Every student will have access to a free Season Pass. The Season Pass is a tiered reward track that students progress through by earning `season_xp`. Each tier unlocks a specific reward.

**Progression:** A student's `season_level` will increase as they accumulate `season_xp`. For example, each level could require 1,000 `season_xp` to unlock. This value can be tuned based on the expected average XP earnings per student.

**Rewards:** Rewards on the Season Pass track could include:
*   Exclusive avatar customizations (borders, frames, effects).
*   Unique badges that display the season and level achieved.
*   Bonus XP grants (e.g., "Unlock Level 10: Receive 500 Bonus XP").
*   Exclusive titles (e.g., "Season 1 Trailblazer").
*   Discounts or special items in the Academy Store.

### 3.3 End-of-Season

At the conclusion of a season, several events will occur:

1.  **Season XP Reset:** The `season_xp` and `season_level` fields for all students will be reset to zero, preparing them for the new season.
2.  **Permanent Rewards:** Students will receive permanent rewards based on their final `season_level`. For example, reaching Level 25 might grant an exclusive, never-to-return badge. This creates a sense of urgency and exclusivity.
3.  **Rank Soft Reset (Optional):** A soft reset of competitive ranks could be considered, where students are placed a few tiers below their end-of-season rank, giving them new goals to strive for.
4.  **Celebration:** An in-app celebration and announcement of top performers, House standings, and other achievements from the concluded season.

---

## Part 4: The Academy Store

The Academy Store is where the XP economy comes full circle, allowing students to spend their hard-earned XP on desirable items.

### 4.1 Store Currency

The primary currency for the Academy Store is **XP**. This is the only mechanism by which a student's lifetime `xp` can decrease. This creates a meaningful choice for students: save XP to climb the ranks faster, or spend it on cool rewards.

### 4.2 Item Categories

The store should offer a diverse range of items to appeal to different students.

| Category | Description | Examples |
| :--- | :--- | :--- |
| **Virtual Goods** | Digital items that customize a student's in-app presence. | Avatar skins, profile banners, animated effects, unique sound packs for in-session events. |
| **Titles** | Text labels that display next to a student's name. | "The Unstoppable," "Team Player," "Fitness Fanatic." |
| **Academy Merchandise** | Real-world, physical items. | T-shirts, water bottles, wristbands, grip socks with custom designs. |
| **Special Privileges** | Unique, non-tangible rewards. | Choose the warm-up music for a session, design a custom challenge, get a shout-out on the academy's social media. |

### 4.3 Pricing Strategy

Item prices should be set to reflect their desirability and the effort required to earn them. A simple virtual item might cost 500 XP, while a piece of physical merchandise could cost 5,000 XP or more. This ensures that the store feels rewarding without devaluing the effort students put into earning their XP.

---

## Part 5: Data Model Specifications

The following outlines the necessary changes to the database schema to support the new gamification system.

### 5.1 Modifications to `students` Table

Three new columns will be added to the existing `students` table.

| Column Name | Data Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `xp` | BIGINT | 0 | The student's lifetime accumulated Experience Points. |
| `season_xp` | INT | 0 | The student's XP earned within the current active season. Resets at season end. |
| `season_level` | INT | 1 | The student's current tier in the Season Pass. Resets at season end. |

### 5.2 New `xp_transactions` Table

This table provides an immutable audit log of all XP awards and deductions.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Unique identifier for the transaction. |
| `student_id` | UUID | FOREIGN KEY (students.id), NOT NULL | The student receiving the XP. |
| `amount` | INT | NOT NULL | The amount of XP (positive for awards, negative for store purchases). |
| `source_type` | TEXT | NOT NULL | An enum-like string indicating the source (e.g., `SESSION_ATTENDANCE`, `COACH_AWARD`, `STORE_PURCHASE`). |
| `description` | TEXT | | An optional description providing context for the transaction. |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Timestamp of the transaction. |

### 5.3 New `seasons` Table

This table defines the parameters for each competitive season.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Unique identifier for the season. |
| `name` | TEXT | NOT NULL | The display name of the season. |
| `start_date` | TIMESTAMPTZ | NOT NULL | The official start date and time of the season. |
| `end_date` | TIMESTAMPTZ | NOT NULL | The official end date and time of the season. |
| `is_active` | BOOLEAN | DEFAULT false | Flag indicating if this is the currently active season. |

### 5.4 New `challenges` Table

This table stores the definitions for all challenges.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Unique identifier for the challenge. |
| `type` | TEXT | NOT NULL | The type of challenge (`DAILY`, `WEEKLY`, `SEASONAL`, `MILESTONE`). |
| `title` | TEXT | NOT NULL | The display title of the challenge. |
| `description` | TEXT | NOT NULL | A detailed description of the requirements. |
| `xp_reward` | INT | NOT NULL | The XP awarded upon completion. |
| `is_active` | BOOLEAN | DEFAULT true | Flag indicating if the challenge is currently available. |

### 5.5 New `student_challenges` Table

This join table tracks each student's progress on their assigned challenges.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Unique identifier for the record. |
| `student_id` | UUID | FOREIGN KEY (students.id), NOT NULL | The student. |
| `challenge_id` | UUID | FOREIGN KEY (challenges.id), NOT NULL | The challenge. |
| `progress` | INT | DEFAULT 0 | The student's current progress towards the goal. |
| `is_completed` | BOOLEAN | DEFAULT false | Flag indicating if the challenge has been completed. |
| `completed_at` | TIMESTAMPTZ | | Timestamp of when the challenge was completed. |
| | | UNIQUE(student_id, challenge_id) | Ensures a student can only have one record per challenge. |

---

## Part 6: Claude Code Implementation Prompt

The following prompt is designed to be given to an AI coding assistant (like Claude) to generate the implementation code for this system.

---

**Prompt:**

You are an expert full-stack developer. Your task is to implement a gamification system for a youth fitness academy application. The backend uses Supabase (PostgreSQL) and the frontend is built with Next.js and React.

**Context:**
The application currently has a `students` table with a `points` field for in-session competition. You need to add a new, parallel system based on "Experience Points" (XP) for long-term progression.

**Task 1: SQL Schema**
Write a SQL script to:
1.  Add `xp` (BIGINT, default 0), `season_xp` (INT, default 0), and `season_level` (INT, default 1) columns to the `students` table.
2.  Create a new `xp_transactions` table with columns: `id` (UUID PK), `student_id` (UUID FK to students), `amount` (INT), `source_type` (TEXT), `description` (TEXT), `created_at` (TIMESTAMPTZ).
3.  Create a new `seasons` table with columns: `id` (SERIAL PK), `name` (TEXT), `start_date` (TIMESTAMPTZ), `end_date` (TIMESTAMPTZ), `is_active` (BOOLEAN).
4.  Create a new `challenges` table with columns: `id` (UUID PK), `type` (TEXT), `title` (TEXT), `description` (TEXT), `xp_reward` (INT), `is_active` (BOOLEAN).
5.  Create a new `student_challenges` table with columns: `id` (UUID PK), `student_id` (UUID FK), `challenge_id` (UUID FK), `progress` (INT), `is_completed` (BOOLEAN), `completed_at` (TIMESTAMPTZ), with a unique constraint on `(student_id, challenge_id)`.

**Task 2: PostgreSQL Function - `award_xp`**
Write a PL/pgSQL function `award_xp(p_student_id UUID, p_amount INT, p_source_type TEXT, p_description TEXT)` that:
1.  Inserts a new row into `xp_transactions`.
2.  Updates the `xp` and `season_xp` columns on the `students` table for the given `p_student_id` by adding `p_amount`.

**Task 3: Next.js API Route - `/api/coach/award-xp`**
Write a Next.js API route handler (using the App Router) that:
1.  Accepts a POST request with a JSON body containing `student_id`, `amount`, and `description`.
2.  Uses the Supabase client to call the `award_xp` function with `source_type` set to `'COACH_AWARD'`.
3.  Returns a success or error response.

**Task 4: React Component - `StudentXPDisplay`**
Write a React component that:
1.  Fetches the current student's `xp`, `season_xp`, and `season_level` from a `/api/student/profile` endpoint.
2.  Displays the lifetime XP prominently.
3.  Displays the Season Level with a progress bar. Assume 1000 `season_xp` is required per level. The progress bar should show the percentage towards the next level.

---

## Appendix A: Rank Thresholds (Existing)

For reference, the existing rank thresholds from the Team Playbook are as follows. These thresholds will now be tied to the new `xp` field instead of `points`.

| Rank | XP Threshold |
| :--- | :--- |
| Noob | 10 |
| Rookie | 85 |
| Challenger | 250 |
| Striker | 450 |
| Warrior | 750 |
| Captain | 1,200 |
| Elite | 3,500 |
| Champion | 5,000 |
| Legend | 8,500 |
| Apex | 15,000 |

---

## Appendix B: House Reference

| House Name | Color | Mascot | Core Value |
| :--- | :--- | :--- | :--- |
| Unity | Blue | Wolf | Teamwork |
| Sage | Green | Owl | Wisdom |
| Spark | Orange | Fox | Creativity |
| Valor | Purple | Badger | Bravery |
