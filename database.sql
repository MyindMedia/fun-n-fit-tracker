-- Fun N' Fit Tracker Database Schema
-- PostgreSQL/Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLE: students
-- Core user records for all athletes
-- ================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "fullName" TEXT NOT NULL,
    "houseId" TEXT NOT NULL CHECK ("houseId" IN ('UNITY', 'SAGE', 'SPARK', 'VALOR')),
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    points INTEGER DEFAULT 0 NOT NULL,
    "hasWearable" BOOLEAN DEFAULT false,
    "deviceId" TEXT,
    "isPresent" BOOLEAN DEFAULT true,
    "avatarUrl" TEXT,
    "rankId" TEXT DEFAULT 'r_noob',
    badges TEXT[] DEFAULT '{}',
    inventory TEXT[] DEFAULT '{}',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: game_sessions
-- Tracks active and historical training drills
-- ================================================
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "gameKey" TEXT NOT NULL,
    title TEXT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "endTime" BIGINT NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "startedBy" TEXT,
    roster TEXT[] DEFAULT '{}',
    results JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: transactions
-- Ledger for all point changes (audit trail)
-- ================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "studentId" UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('MANUAL', 'FIT', 'REDEMPTION')),
    description TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: notifications
-- Global activity feed for ticker and dashboard
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('POINTS', 'RANK_UP', 'GAME_END', 'ENROLL', 'BADGE_EARNED', 'REWARD_CLAIMED')),
    "studentId" UUID REFERENCES students(id) ON DELETE SET NULL,
    "studentName" TEXT,
    "avatarUrl" TEXT,
    "houseId" TEXT CHECK ("houseId" IN ('UNITY', 'SAGE', 'SPARK', 'VALOR')),
    message TEXT NOT NULL,
    amount INTEGER,
    timestamp BIGINT NOT NULL,
    "adminName" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: game_library
-- Definitions of available fitness drills
-- ================================================
CREATE TABLE IF NOT EXISTS game_library (
    game_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    house_trait_focus TEXT,
    min_players INTEGER DEFAULT 1,
    max_players INTEGER DEFAULT 100,
    recommended_age_band TEXT,
    duration_default_seconds INTEGER DEFAULT 300,
    equipment_checklist TEXT[] DEFAULT '{}',
    setup_steps TEXT[] DEFAULT '{}',
    rules TEXT[] DEFAULT '{}',
    scoring_rules TEXT,
    penalties TEXT,
    tie_breaker TEXT,
    safety_notes TEXT,
    accessibility_variants TEXT,
    coach_script_short TEXT,
    data_capture_fields TEXT[] DEFAULT '{}',
    leaderboard_metric TEXT DEFAULT 'score',
    template_id TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: badges
-- Achievement badges that can be awarded
-- ================================================
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT,
    color TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: rewards
-- Items available for purchase with points
-- ================================================
CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cost INTEGER NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Virtual', 'Real')),
    description TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: ranks
-- Progression levels based on point thresholds
-- ================================================
CREATE TABLE IF NOT EXISTS ranks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: app_settings
-- Key-value configuration store
-- ================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    value TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: drill_presets
-- Saved drill configurations for quick launch
-- ================================================
CREATE TABLE IF NOT EXISTS drill_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    game_key TEXT NOT NULL,
    default_duration INTEGER DEFAULT 600,
    default_roster TEXT[],
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INDEXES for performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_students_house ON students("houseId");
CREATE INDEX IF NOT EXISTS idx_students_present ON students("isPresent");
CREATE INDEX IF NOT EXISTS idx_students_points ON students(points DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions("isActive");
CREATE INDEX IF NOT EXISTS idx_transactions_student ON transactions("studentId");
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);

-- ================================================
-- Row Level Security (RLS) - Enable for production
-- ================================================
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- For development/demo, you may want to allow anonymous access:
-- CREATE POLICY "Allow anonymous access" ON students FOR ALL USING (true);
-- (Repeat for other tables as needed)

-- ================================================
-- STORAGE BUCKET
-- ================================================
-- You'll need to create a storage bucket named 'Assets' in Supabase dashboard
-- with public read access for avatars, logos, and team images

-- ================================================
-- SAMPLE DATA SEED (Optional)
-- ================================================
-- You can uncomment this to seed initial data

/*
-- Seed Ranks
INSERT INTO ranks (id, name, threshold, icon, color, description) VALUES
('r_noob', 'Noob', 0, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Noob.png', '#94a3b8', 'Just hatching!'),
('r_rookie', 'Rookie', 100, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Rookie.png', '#4ade80', 'Growing strong.'),
('r_challenger', 'Challenger', 250, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Challenger.png', '#fb923c', 'Stepping up!'),
('r_striker', 'Striker', 500, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Striker.png', '#22d3ee', 'Fast as lightning.'),
('r_warrior', 'Warrior', 1000, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Warrior.png', '#f87171', 'Battle ready.'),
('r_captain', 'Captain', 2000, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Captain.png', '#60a5fa', 'Leading the way.'),
('r_elite', 'Elite', 3500, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Elite.png', '#818cf8', 'Top tier talent.'),
('r_champion', 'Champion', 5000, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Champion.png', '#fbbf24', 'Victory is yours.'),
('r_legend', 'Legend', 7500, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Legend.png', '#a78bfa', 'Simply legendary.'),
('r_apex', 'Apex', 10000, 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/levels/Apex.png', '#f43f5e', 'The pinnacle of fitness.')
ON CONFLICT (id) DO NOTHING;

-- Seed Badges
INSERT INTO badges (id, name, icon, description, color) VALUES
('b_first_drill', 'First Drill', '🚀', 'Completed your very first academy drill!', '#60a5fa'),
('b_powerhouse', 'Powerhouse', '⚡', 'Earned 50+ points in a single session.', '#fbbf24'),
('b_consistency', 'Early Bird', '🌅', 'Marked present for 3 consecutive days.', '#4ade80'),
('b_mvp', 'Game MVP', '🏆', 'Awarded MVP status by a coach.', '#f43f5e'),
('b_team_player', 'Team Spirit', '🤝', 'Participated in 5 group challenges.', '#a78bfa')
ON CONFLICT (id) DO NOTHING;

-- Seed Rewards
INSERT INTO rewards (id, name, cost, icon, category, description) VALUES
('r_aura', 'Golden Aura', 100, '✨', 'Virtual', 'Give your profile a shimmering gold border.'),
('r_shades', 'Cool Shades', 250, '😎', 'Virtual', 'Avatar item: Epic sunglasses for your profile.'),
('r_water', 'Premium Bottle', 500, '💧', 'Real', 'Claim a branded academy water bottle.'),
('r_shirt', 'House Jersey', 2000, '👕', 'Real', 'Unlock your official House colored training jersey.'),
('r_coach', 'Coach for a Drill', 5000, '🧢', 'Real', 'Lead the next drill alongside the coaching staff.')
ON CONFLICT (id) DO NOTHING;
*/

-- ========================================
-- PARENT STUDENT LINKS AND RLS
-- ========================================

-- Create the parent_student_links table
CREATE TABLE IF NOT EXISTS parent_student_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL,
    student_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- Enable RLS on the new table
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can only view, insert, and delete their own links
CREATE POLICY "Parents can view their own links" ON parent_student_links
    FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert their own links" ON parent_student_links
    FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can delete their own links" ON parent_student_links
    FOR DELETE USING (auth.uid() = parent_id);

-- Enable RLS on students table if not already enabled
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Allow creating new students.
CREATE POLICY "Enable insert for authenticated users only" ON students
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON students
    FOR SELECT USING (true);
    
CREATE POLICY "Enable update for all users" ON students
    FOR UPDATE USING (true);
