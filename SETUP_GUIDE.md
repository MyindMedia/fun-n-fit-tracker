# Fun N' Fit Tracker - Complete Setup Guide

This guide will walk you through setting up the Fun N' Fit Tracker application from scratch.

---

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works fine)
- Google AI Studio account (optional, for AI drill suggestions)

---

## Step 1: Supabase Project Setup

### 1.1 Create a New Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in project details:
   - **Name:** fun-n-fit-tracker
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to your location
5. Click "Create new project" and wait ~2 minutes

### 1.2 Set Up the Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `database.sql` from this project
4. Paste into the SQL editor
5. Click "Run" (bottom right)
6. You should see: "Success. No rows returned"

**Verify it worked:**
- Go to **Table Editor**
- You should see 9 tables: `students`, `game_sessions`, `transactions`, `notifications`, `game_library`, `badges`, `rewards`, `ranks`, `app_settings`

### 1.3 Create Storage Bucket

1. In Supabase, go to **Storage**
2. Click "New bucket"
3. Name it: `Assets`
4. Make it **Public** (toggle on)
5. Click "Create bucket"

### 1.4 Upload Assets (Optional)

You can upload your own assets or use placeholder images:

**Required folder structure:**
```
Assets/
├── FNFLogo.png          (Your academy logo)
├── team/
│   ├── unity.png        (Unity house logo)
│   ├── sage.png         (Sage house logo)
│   ├── spark.png        (Spark house logo)
│   └── valor.png        (Valor house logo)
└── levels/
    ├── Noob.png
    ├── Rookie.png
    ├── Challenger.png
    ├── Striker.png
    ├── Warrior.png
    ├── Captain.png
    ├── Elite.png
    ├── Champion.png
    ├── Legend.png
    └── Apex.png
```

**Quick tip:** You can use emoji PNGs or simple colored circles as placeholders initially.

### 1.5 Get Your API Credentials

1. In Supabase, go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (the long JWT token)

---

## Step 2: Configure Environment Variables

### 2.1 Update .env.local

Open `.env.local` in the project root and update:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE

# Google Gemini AI (Optional)
VITE_GEMINI_API_KEY=YOUR_GEMINI_KEY_OR_LEAVE_AS_PLACEHOLDER
```

**Replace:**
- `YOUR_PROJECT_ID` with your actual Supabase project URL
- `YOUR_ANON_KEY_HERE` with the anon public key from Step 1.5

### 2.2 Get Gemini API Key (Optional)

The AI drill suggestion feature requires a Google Gemini API key:

1. Go to [https://ai.google.dev/](https://ai.google.dev/)
2. Click "Get API key in Google AI Studio"
3. Sign in with Google
4. Create a new API key
5. Copy it and paste into `.env.local` as `VITE_GEMINI_API_KEY`

**Note:** If you skip this, the app will still work but use fallback drill suggestions.

---

## Step 3: Seed Initial Data (Optional)

To populate the database with sample ranks, badges, and rewards:

### Option A: Use SQL Seed Data

1. Go to Supabase **SQL Editor**
2. Open `database.sql`
3. Scroll to the bottom (line 188)
4. **Uncomment** the entire seed data section (remove `/*` and `*/`)
5. Copy just the INSERT statements
6. Run in SQL Editor

### Option B: Let the App Seed Automatically

The app includes a `seedDatabase()` function that can be called from the admin panel. However, you'll need to manually trigger it via browser console:

```javascript
import { supabaseService } from './services/supabaseService';
supabaseService.seedDatabase();
```

---

## Step 4: Install and Run the Application

### 4.1 Install Dependencies

```bash
npm install
```

### 4.2 Start Development Server

```bash
npm run dev
```

You should see:
```
VITE v6.2.0  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4.3 Open the Application

Visit `http://localhost:5173/` in your browser.

You should see:
- **Route `/live`** - Public leaderboard view (for display on TVs)
- **Route `/admin`** - Coach dashboard

---

## Step 5: Configure Row Level Security (Production Only)

**⚠️ Important for production deployments!**

By default, the database has RLS disabled for easier development. Before going live:

### 5.1 Enable RLS on All Tables

In Supabase SQL Editor, run:

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
```

### 5.2 Create Policies

For a public leaderboard with admin-only writes:

```sql
-- Allow everyone to read
CREATE POLICY "Public read access" ON students FOR SELECT USING (true);
CREATE POLICY "Public read access" ON game_sessions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON notifications FOR SELECT USING (true);
CREATE POLICY "Public read access" ON badges FOR SELECT USING (true);
CREATE POLICY "Public read access" ON rewards FOR SELECT USING (true);
CREATE POLICY "Public read access" ON ranks FOR SELECT USING (true);

-- Admin-only writes would require authentication setup
-- See Supabase Auth documentation for implementing admin roles
```

---

## Step 6: Create Your First Students

### Option 1: Use the Admin Panel

1. Go to `http://localhost:5173/#/admin`
2. Click "Enroll New Athlete"
3. Fill in:
   - Full Name
   - House (Unity, Sage, Spark, or Valor)
   - Gender
   - Optionally take a photo
4. Click "Enroll"

### Option 2: Seed with SQL

```sql
INSERT INTO students ("fullName", "houseId", gender, points, "rankId", "avatarUrl", "isPresent") VALUES
('Alex Rivera', 'UNITY', 'Male', 120, 'r_rookie', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', true),
('Sarah Chen', 'SAGE', 'Female', 450, 'r_challenger', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', true),
('Marcus Johnson', 'SPARK', 'Male', 850, 'r_striker', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus', true),
('Emma Davis', 'VALOR', 'Female', 320, 'r_challenger', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma', true);
```

---

## Step 7: Launch Your First Drill

1. Go to Admin Dashboard (`/admin`)
2. Click **"Launch New Drill"**
3. Select a game from the library (e.g., "Relay Races")
4. Select which students are participating (check boxes)
5. Set duration (in minutes)
6. Click **"Start Drill"**

The leaderboard view (`/live`) will automatically show a countdown overlay!

---

## Troubleshooting

### Issue: "Missing Supabase configuration" error

**Solution:** Check that `.env.local` has correct values and restart the dev server.

### Issue: Database tables not created

**Solution:**
1. Verify you ran the entire `database.sql` file
2. Check Supabase logs for errors
3. Make sure you're using PostgreSQL 14+

### Issue: Real-time updates not working

**Solution:**
1. Check that your Supabase plan includes real-time (free tier does)
2. Verify the real-time API is enabled in Project Settings > API
3. Check browser console for WebSocket errors

### Issue: Images/avatars not loading

**Solution:**
1. Verify the `Assets` bucket exists and is public
2. Check the image URLs in the database match the storage bucket path
3. Upload missing files to the correct folders

### Issue: AI suggestions not working

**Solution:**
1. Verify `VITE_GEMINI_API_KEY` is set and not "PLACEHOLDER_API_KEY"
2. Check that the API key is valid in Google AI Studio
3. Restart the dev server after changing `.env.local`

---

## Production Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Add environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
4. Deploy!

### Deploy to Netlify

1. Build the app: `npm run build`
2. Upload the `dist/` folder to Netlify
3. Add environment variables in Netlify site settings

---

## Next Steps

- **Customize Houses:** Edit `constants.ts` to change house names, colors, and mascots
- **Add More Drills:** Edit `constants.ts` GAME_LIBRARY or add to database
- **Customize Ranks:** Modify thresholds and names in the `ranks` table
- **Branding:** Upload your academy logo via Admin > Settings
- **Set Up Projector Mode:** Open `/live` view on a large screen and press "P" to hide navigation

---

## Support

For issues or questions:
1. Check `FIXES_APPLIED.md` for known issues and solutions
2. Review Supabase logs for backend errors
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

---

**You're all set! Start training and have fun! 🏃‍♂️💪**
