
# Fun N' Fit Point Tracker: Technical Blueprint

## 1. Project Overview
**Fun N' Fit Tracker** is a gamified fitness management system designed for children's fitness academies. It transforms physical training into a high-stakes, real-time digital competition using house-based points, level-up systems, and AI-driven game generation.

---

## 2. Infrastructure & Tech Stack

### Frontend Architecture
- **Framework:** React 19 (Functional Components, Hooks)
- **Styling:** Tailwind CSS (Utility-first, responsive design)
- **State Management:** Real-time Event-Driven architecture via Supabase JS SDK.
- **Charts:** Recharts (SVG-based responsive visualizations)
- **Audio Engine:** Custom Web Audio API Synthesizer (Zero-dependency SFX)

### Backend & Cloud Services
- **Real-time Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (S3-compatible) for profile photos and brand assets.
- **AI Integration:** Google Gemini API (`gemini-3-flash-preview`) for dynamic game design.
- **Authentication:** Role-based access (Coach vs. Public Board) via local session state.

---

## 3. Database Schema (PostgreSQL)

### Table: `students`
Primary athlete record and point state.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier for the athlete. |
| `fullName` | TEXT | Athlete's full name. |
| `houseId` | TEXT | One of: `UNITY`, `SAGE`, `SPARK`, `VALOR`. |
| `gender` | TEXT | `Male` or `Female` (used for avatars/filters). |
| `points` | INTEGER | Current session/total points. |
| `rankId` | TEXT | Current level ID (e.g., `r_noob`, `r_legend`). |
| `avatarUrl` | TEXT | Public URL to profile image (Supabase Storage). |
| `isPresent` | BOOLEAN | Attendance toggle for active sessions. |
| `hasWearable` | BOOLEAN | Flag for device integration status. |

### Table: `student_notes`
Qualitative feedback and progress logs from coaches.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `studentId` | UUID (FK) | Reference to the athlete. |
| `coachName` | TEXT | Name of the coach who wrote the note. |
| `content` | TEXT | The content of the observation. |
| `createdAt` | TIMESTAMPTZ | ISO 8601 timestamp. |

### Table: `notifications`
Audit log and real-time activity feed.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `type` | TEXT | `POINTS`, `RANK_UP`, `GAME_END`, `ENROLL`. |
| `message` | TEXT | Human-readable description of the event. |
| `adminName` | TEXT | Name of the coach who triggered the event. |
| `studentId` | UUID (FK) | Reference to the athlete. |
| `amount` | INTEGER | Delta of points (if applicable). |
| `timestamp` | TIMESTAMPTZ | ISO 8601 timestamp. |

### Table: `game_sessions`
Active and historical drill records.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `title` | TEXT | Name of the fitness game. |
| `startTime` | BIGINT | Milliseconds (JS Date.now()). |
| `endTime` | BIGINT | Milliseconds (JS Date.now()). |
| `isActive` | BOOLEAN | True if the timer is currently running. |
| `roster` | JSONB | Array of student IDs participating. |
| `results` | JSONB | Summary of winner, MVP, and scores. |

### Table: `transactions`
Detailed ledger for point auditing.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier. |
| `studentId` | UUID (FK) | Reference to the athlete. |
| `amount` | INTEGER | Points awarded/deducted. |
| `sourceType` | TEXT | `MANUAL` (Coach) or `FIT` (Wearable). |
| `description` | TEXT | Reason for points. |
| `adminName` | TEXT | Attribution. |

---

## 4. Storage Infrastructure
The app utilizes a Supabase Storage Bucket named **`Assets`**.
- **`/avatars`**: Stores compressed athlete profile photos.
- **`/team`**: Stores house logos (e.g., `unity.png`).
- **`/levels`**: Stores rank icons (e.g., `Noob.png`, `Elite.png`).
- **`/branding`**: Stores the main app logo.

---

## 5. Build & Deployment Requirements
1. **Environment Variables**: `process.env.API_KEY` is required for Gemini AI features.
2. **Supabase Config**: Requires a Supabase URL and Anon Key.
3. **Real-time Enablement**: "Replication" must be enabled for the `students`, `notifications`, and `game_sessions` tables in the Supabase Dashboard.
4. **Permissions**: The app requests `camera` permissions in `metadata.json` for enrollment.

---

## 6. Feature Roadmap & Missing Functions

### Priority 1: Smart Analytics
- **Missing**: A "Progress Report" generator.
- **Requirement**: A view that aggregates `transactions` per student to show weekly point velocity.

### Priority 2: Physical Check-In
- **Missing**: QR Code / NFC reader integration.
- **Requirement**: Use a library like `jsqr` to allow athletes to "scan in" to the building, automatically setting `isPresent` to true.

### Priority 3: Achievement Engine
- **Missing**: A dedicated "Badges" UI.
- **Requirement**: A separate table `badges` that awards digital stickers for streaks (e.g., "3 days in a row").

### Priority 4: House Challenges
- **Missing**: Dual-drill support.
- **Requirement**: Logic to allow Unity/Sage to play "Game A" while Spark/Valor play "Game B".

---

## 7. AI Expansion Prompts
Use these prompts with Gemini to build out the missing functions:

**For Analytics:**
> "Build a new Admin tab called 'Insights'. Fetch the last 30 days of transactions and use Recharts to show a stacked area chart of points earned by House per day."

**For QR Check-in:**
> "Add a QR scanner to the Attendance column in the Admin table. When a QR is scanned, match the ID to the student record and play a high-pitched 'Check-in' chime using AudioService."

**For Achievement Badges:**
> "In StudentProfileModal, add a 'Trophy Case' section. Create a function that checks if a student has earned more than 500 points in a single session and awards a 'Powerhouse' badge."
