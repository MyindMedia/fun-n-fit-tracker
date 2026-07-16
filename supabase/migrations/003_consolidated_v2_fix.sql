-- Consolidated V2 Fix - Run this if you are having "Failed to save" errors
-- This script ensures all necessary columns exist for the V2 profile features.

-- 1. Add Bio (often missing)
ALTER TABLE students ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Add Gamertag & Display Preferences
ALTER TABLE students ADD COLUMN IF NOT EXISTS gamertag TEXT UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS display_preference TEXT DEFAULT 'gamertag' CHECK (display_preference IN ('gamertag', 'fullName'));

-- 3. Add XP Fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS season_xp INT DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS season_level INT DEFAULT 1;

-- 4. Add Avatar URL (if somehow missing)
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 5. Re-apply RLS policies just in case
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Allow students to update their own profile (Bio, Gamertag, Avatar)
CREATE POLICY "Students can update own profile" ON students
    FOR UPDATE USING (auth.uid() = id);

-- Allow public read of students (for leaderboards/search)
CREATE POLICY "Public read students" ON students
    FOR SELECT USING (true);
