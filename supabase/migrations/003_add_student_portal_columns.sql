-- Migration: Add Student Portal columns to students table
-- Run this in your Supabase SQL Editor

-- Add gamer_tag column for custom display names
ALTER TABLE students ADD COLUMN IF NOT EXISTS gamer_tag TEXT;

-- Add bio column for student descriptions
ALTER TABLE students ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add display_preference column (FULL_NAME, GAMER_TAG, or INITIALS)
ALTER TABLE students ADD COLUMN IF NOT EXISTS display_preference TEXT DEFAULT 'FULL_NAME';

-- Add friend_ids column for friend list
ALTER TABLE students ADD COLUMN IF NOT EXISTS friend_ids TEXT[] DEFAULT '{}';

-- Add total_xp column for XP tracking
ALTER TABLE students ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'students'
AND column_name IN ('gamer_tag', 'bio', 'display_preference', 'friend_ids', 'total_xp');
