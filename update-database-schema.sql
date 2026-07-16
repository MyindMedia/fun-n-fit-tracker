-- ========================================
-- SUPABASE SCHEMA UPDATE SCRIPT
-- Run this in Supabase SQL Editor to fix all column mismatches
-- ========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- FIX STUDENTS TABLE
-- ========================================

-- Add missing columns if they don't exist
ALTER TABLE students ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "houseId" TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "hasWearable" BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "isPresent" BOOLEAN DEFAULT true;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "rankId" TEXT DEFAULT 'r_noob';
ALTER TABLE students ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
ALTER TABLE students ADD COLUMN IF NOT EXISTS inventory TEXT[] DEFAULT '{}';
ALTER TABLE students ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();

-- Set NOT NULL constraints where needed (only if column has data)
DO $$
BEGIN
    -- Only set NOT NULL if column exists and has no nulls
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'fullName') THEN
        UPDATE students SET "fullName" = 'Unknown' WHERE "fullName" IS NULL;
        ALTER TABLE students ALTER COLUMN "fullName" SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'houseId') THEN
        UPDATE students SET "houseId" = 'UNITY' WHERE "houseId" IS NULL;
        ALTER TABLE students ALTER COLUMN "houseId" SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'gender') THEN
        UPDATE students SET gender = 'Male' WHERE gender IS NULL;
        ALTER TABLE students ALTER COLUMN gender SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'points') THEN
        UPDATE students SET points = 0 WHERE points IS NULL;
        ALTER TABLE students ALTER COLUMN points SET NOT NULL;
        ALTER TABLE students ALTER COLUMN points SET DEFAULT 0;
    END IF;
END $$;

-- Add constraints
DO $$
BEGIN
    -- Add houseId check constraint if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_houseid_check') THEN
        ALTER TABLE students ADD CONSTRAINT students_houseid_check
            CHECK ("houseId" IN ('UNITY', 'SAGE', 'SPARK', 'VALOR'));
    END IF;

    -- Add gender check constraint if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_gender_check') THEN
        ALTER TABLE students ADD CONSTRAINT students_gender_check
            CHECK (gender IN ('Male', 'Female'));
    END IF;
END $$;

-- ========================================
-- FIX GAME_SESSIONS TABLE
-- ========================================

-- Add missing columns if they don't exist
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "startTime" BIGINT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "endTime" BIGINT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "startedBy" TEXT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS roster TEXT[] DEFAULT '{}';
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS results JSONB;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "gameKey" TEXT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();

-- Set NOT NULL constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'title') THEN
        UPDATE game_sessions SET title = 'Unknown Game' WHERE title IS NULL;
        ALTER TABLE game_sessions ALTER COLUMN title SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'startTime') THEN
        UPDATE game_sessions SET "startTime" = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000 WHERE "startTime" IS NULL;
        ALTER TABLE game_sessions ALTER COLUMN "startTime" SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'endTime') THEN
        UPDATE game_sessions SET "endTime" = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000 + 600000 WHERE "endTime" IS NULL;
        ALTER TABLE game_sessions ALTER COLUMN "endTime" SET NOT NULL;
    END IF;
END $$;

-- ========================================
-- FIX TRANSACTIONS TABLE
-- ========================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "adminName" TEXT;

-- ========================================
-- FIX NOTIFICATIONS TABLE
-- ========================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS timestamp BIGINT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "adminName" TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "studentName" TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS amount INTEGER;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
        UPDATE notifications SET type = 'INFO' WHERE type IS NULL;
        ALTER TABLE notifications ALTER COLUMN type SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'message') THEN
        UPDATE notifications SET message = '' WHERE message IS NULL;
        ALTER TABLE notifications ALTER COLUMN message SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'timestamp') THEN
        UPDATE notifications SET timestamp = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000 WHERE timestamp IS NULL;
        ALTER TABLE notifications ALTER COLUMN timestamp SET NOT NULL;
    END IF;
END $$;

-- ========================================
-- FIX GAME_LIBRARY TABLE
-- ========================================

ALTER TABLE game_library ADD COLUMN IF NOT EXISTS "gameKey" TEXT;
ALTER TABLE game_library ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE game_library ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE game_library ADD COLUMN IF NOT EXISTS rules TEXT[];
ALTER TABLE game_library ADD COLUMN IF NOT EXISTS "durationDefaultSeconds" INTEGER DEFAULT 600;

-- ========================================
-- FIX BADGES TABLE
-- ========================================

ALTER TABLE badges ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS "pointsRequired" INTEGER;

-- ========================================
-- FIX REWARDS TABLE
-- ========================================

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- ========================================
-- FIX RANKS TABLE
-- ========================================

ALTER TABLE ranks ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE ranks ADD COLUMN IF NOT EXISTS "minPoints" INTEGER;
ALTER TABLE ranks ADD COLUMN IF NOT EXISTS icon TEXT;

-- ========================================
-- FIX APP_SETTINGS TABLE
-- ========================================

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS value TEXT;

-- ========================================
-- CREATE DRILL_PRESETS TABLE IF NOT EXISTS
-- ========================================

CREATE TABLE IF NOT EXISTS drill_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    game_key TEXT NOT NULL,
    default_duration INTEGER DEFAULT 600,
    default_roster TEXT[],
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- REFRESH SCHEMA CACHE
-- ========================================

-- Force Supabase to reload the schema
NOTIFY pgrst, 'reload schema';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Show students table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'students'
ORDER BY ordinal_position;

-- Show game_sessions table structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'game_sessions'
ORDER BY ordinal_position;

-- Count records to verify data is intact
SELECT
    'students' as table_name, COUNT(*) as record_count FROM students
UNION ALL
SELECT 'game_sessions', COUNT(*) FROM game_sessions
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'game_library', COUNT(*) FROM game_library
UNION ALL
SELECT 'badges', COUNT(*) FROM badges
UNION ALL
SELECT 'rewards', COUNT(*) FROM rewards
UNION ALL
SELECT 'ranks', COUNT(*) FROM ranks;
