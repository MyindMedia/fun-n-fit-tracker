-- Fun N' Fit Academy v2 Gamification System Database Schema Extensions
-- This migration adds all v2 gamification features to the existing database

-- ================================================
-- TABLE: seasons
-- Season management for competitive periods
-- ================================================
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    is_active BOOLEAN DEFAULT false,
    theme TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_seasons_active ON seasons(is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_status ON seasons(status);

-- ================================================
-- TABLE: xp_transactions
-- Track XP earnings for long-term progression
-- ================================================
CREATE TABLE IF NOT EXISTS xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    season_id INT REFERENCES seasons(id),
    amount INT NOT NULL CHECK (amount > 0),
    source_type TEXT NOT NULL CHECK (source_type IN (
        'SESSION_ATTENDANCE', 'GAME_WIN', 'CHALLENGE_COMPLETED', 
        'STREAK_BONUS', 'COACH_AWARD', 'STORE_PURCHASE', 
        'SEASON_REWARD', 'TOURNAMENT_PRIZE', 'OTHER'
    )),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_xp_transactions_student ON xp_transactions(student_id);
CREATE INDEX idx_xp_transactions_season ON xp_transactions(season_id);
CREATE INDEX idx_xp_transactions_created ON xp_transactions(created_at DESC);

-- ================================================
-- TABLE: wearables
-- Avatar customization items catalog
-- ================================================
CREATE TABLE IF NOT EXISTS wearables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('BASE_FACE', 'HAIRSTYLE', 'TOP', 'ACCESSORY')),
    file_path TEXT NOT NULL,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    xp_cost INT DEFAULT 0,
    unlock_method TEXT DEFAULT 'purchase' CHECK (unlock_method IN (
        'default', 'purchase', 'achievement', 'rank', 'season_pass', 'tournament'
    )),
    unlock_requirement TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wearables_slot ON wearables(slot);
CREATE INDEX idx_wearables_rarity ON wearables(rarity);

-- ================================================
-- TABLE: student_wearables
-- Track which students own which wearables
-- ================================================
CREATE TABLE IF NOT EXISTS student_wearables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    wearable_id TEXT REFERENCES wearables(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, wearable_id)
);

CREATE INDEX idx_student_wearables_student ON student_wearables(student_id);

-- ================================================
-- TABLE: student_avatars
-- Current avatar configuration for each student
-- ================================================
CREATE TABLE IF NOT EXISTS student_avatars (
    student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    base_face_id TEXT REFERENCES wearables(id),
    top_id TEXT REFERENCES wearables(id),
    hairstyle_id TEXT REFERENCES wearables(id),
    accessory_id TEXT REFERENCES wearables(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- TABLE: tournaments
-- Tournament definitions and metadata
-- ================================================
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('SINGLE_ELIM', 'DOUBLE_ELIM', 'ROUND_ROBIN', 'HOUSE_BATTLE')),
    status TEXT DEFAULT 'REGISTRATION' CHECK (status IN ('REGISTRATION', 'SEEDING', 'ACTIVE', 'COMPLETED')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    max_participants INT,
    prize_pool JSONB,
    season_id INT REFERENCES seasons(id),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_start_date ON tournaments(start_date);

-- ================================================
-- TABLE: tournament_participants
-- Students enrolled in tournaments
-- ================================================
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    seed_position INT,
    final_placement INT,
    points_earned INT DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tournament_id, student_id)
);

CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_student ON tournament_participants(student_id);

-- ================================================
-- TABLE: tournament_matches
-- Individual matches within tournaments
-- ================================================
CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    match_number INT NOT NULL,
    participant1_id UUID REFERENCES tournament_participants(id),
    participant2_id UUID REFERENCES tournament_participants(id),
    winner_id UUID REFERENCES tournament_participants(id),
    score1 INT,
    score2 INT,
    status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')),
    scheduled_time TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_tournament_matches_round ON tournament_matches(round_number);

-- ================================================
-- TABLE: friends
-- Social connections between students
-- ================================================
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES students(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES students(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    created_at TIMESTAMPTZ DEFAULT now(),
    responded_at TIMESTAMPTZ,
    UNIQUE(requester_id, recipient_id)
);

CREATE INDEX idx_friends_requester ON friends(requester_id);
CREATE INDEX idx_friends_recipient ON friends(recipient_id);
CREATE INDEX idx_friends_status ON friends(status);

-- ================================================
-- TABLE: challenges
-- Predefined challenges for XP earning
-- ================================================
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    xp_reward INT NOT NULL,
    criteria JSONB,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- TABLE: student_challenges
-- Track student challenge completions
-- ================================================
CREATE TABLE IF NOT EXISTS student_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT now(),
    progress JSONB,
    UNIQUE(student_id, challenge_id)
);

-- ================================================
-- TABLE: season_reports
-- Generated reports for season end
-- ================================================
CREATE TABLE IF NOT EXISTS season_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    season_id INT REFERENCES seasons(id) ON DELETE CASCADE,
    report_type TEXT DEFAULT 'STUDENT' CHECK (report_type IN ('STUDENT', 'ADMIN')),
    report_data JSONB,
    pdf_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, season_id, report_type)
);

CREATE INDEX idx_season_reports_student ON season_reports(student_id);
CREATE INDEX idx_season_reports_season ON season_reports(season_id);

-- ================================================
-- TABLE: blog_posts
-- Announcements and content for portal
-- ================================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    author_id UUID,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    target_audience TEXT DEFAULT 'ALL' CHECK (target_audience IN ('ALL', 'STUDENTS', 'PARENTS', 'COACHES', 'ADMINS')),
    priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX idx_blog_posts_audience ON blog_posts(target_audience);

-- ================================================
-- MODIFY EXISTING TABLES
-- ================================================

-- Add XP and gamertag fields to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS season_xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS season_level INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS gamertag TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS display_preference TEXT DEFAULT 'gamertag' CHECK (display_preference IN ('gamertag', 'fullName'));

CREATE INDEX IF NOT EXISTS idx_students_gamertag ON students(gamertag);
CREATE INDEX IF NOT EXISTS idx_students_xp ON students(xp DESC);

-- Add season tracking to existing transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);

CREATE INDEX IF NOT EXISTS idx_transactions_season ON transactions(season_id);

-- Extend ranks table with XP rewards and branding
ALTER TABLE ranks 
ADD COLUMN IF NOT EXISTS xp_reward INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_required INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS criteria_tasks TEXT[],
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'RANK' CHECK (type IN ('RANK', 'TROPHY'));

-- ================================================
-- CORE FUNCTIONS
-- ================================================

-- Award XP function
CREATE OR REPLACE FUNCTION award_xp(
    p_student_id UUID,
    p_amount INT,
    p_source_type TEXT,
    p_description TEXT DEFAULT NULL
) RETURNS TABLE(new_xp_balance INT, new_season_xp INT) AS $$
DECLARE
    v_season_id INT;
BEGIN
    -- Get current active season
    SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
    
    -- Insert XP transaction
    INSERT INTO xp_transactions (student_id, season_id, amount, source_type, description)
    VALUES (p_student_id, v_season_id, p_amount, p_source_type, p_description);
    
    -- Update student XP totals and return new balances
    UPDATE students 
    SET xp = xp + p_amount, season_xp = season_xp + p_amount 
    WHERE id = p_student_id
    RETURNING students.xp, students.season_xp;
END;
$$ LANGUAGE plpgsql;

-- Calculate team points for current season
CREATE OR REPLACE FUNCTION calculate_team_points(p_house_id TEXT) RETURNS INT AS $$
DECLARE
    v_total INT;
    v_season_start TIMESTAMPTZ;
BEGIN
    -- Get current season start date
    SELECT start_date INTO v_season_start FROM seasons WHERE is_active = true LIMIT 1;
    
    -- Sum points from transactions, excluding REDEMPTION type
    SELECT COALESCE(SUM(t.amount), 0) INTO v_total
    FROM transactions t
    JOIN students s ON t.studentId = s.id
    WHERE s.houseId = p_house_id 
    AND t.createdAt >= COALESCE(v_season_start, '1970-01-01')
    AND t.sourceType != 'REDEMPTION';
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Get student level based on season XP
CREATE OR REPLACE FUNCTION get_student_level(p_season_xp INT) RETURNS INT AS $$
BEGIN
    RETURN CASE 
        WHEN p_season_xp >= 10000 THEN 10
        WHEN p_season_xp >= 7500 THEN 9
        WHEN p_season_xp >= 5000 THEN 8
        WHEN p_season_xp >= 3500 THEN 7
        WHEN p_season_xp >= 2000 THEN 6
        WHEN p_season_xp >= 1000 THEN 5
        WHEN p_season_xp >= 500 THEN 4
        WHEN p_season_xp >= 250 THEN 3
        WHEN p_season_xp >= 100 THEN 2
        ELSE 1
    END;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- ROW LEVEL SECURITY POLICIES
-- ================================================

-- Enable RLS on new tables
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearables ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_wearables ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- XP Transactions - Students can only view their own transactions
CREATE POLICY "Students view own XP transactions" ON xp_transactions
    FOR SELECT USING (auth.uid() = student_id);

-- Wearables - Public read access for catalog
CREATE POLICY "Public read wearables" ON wearables
    FOR SELECT USING (true);

-- Student Wearables - Students can view their own items
CREATE POLICY "Students view own wearables" ON student_wearables
    FOR SELECT USING (auth.uid() = student_id);

-- Student Avatars - Students can update their own avatar
CREATE POLICY "Students manage own avatar" ON student_avatars
    FOR ALL USING (auth.uid() = student_id);

-- Tournaments - Public read, admin write
CREATE POLICY "Public read tournaments" ON tournaments
    FOR SELECT USING (true);

CREATE POLICY "Admin manage tournaments" ON tournaments
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Tournament Participants - Students can join tournaments
CREATE POLICY "Students join tournaments" ON tournament_participants
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Public view participants" ON tournament_participants
    FOR SELECT USING (true);

-- Friends - Students can manage their own friend relationships
CREATE POLICY "Students manage own friends" ON friends
    FOR ALL USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Challenges - Public read access
CREATE POLICY "Public read challenges" ON challenges
    FOR SELECT USING (is_active = true);

-- Student Challenges - Students can view their own progress
CREATE POLICY "Students view own challenges" ON student_challenges
    FOR SELECT USING (auth.uid() = student_id);

-- Season Reports - Students can view their own reports
CREATE POLICY "Students view own reports" ON season_reports
    FOR SELECT USING (auth.uid() = student_id);

-- Blog Posts - Public read for published posts
CREATE POLICY "Public read published posts" ON blog_posts
    FOR SELECT USING (is_published = true);

CREATE POLICY "Admin manage blog posts" ON blog_posts
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Seasons - Public read, admin write
CREATE POLICY "Public read seasons" ON seasons
    FOR SELECT USING (true);

CREATE POLICY "Admin manage seasons" ON seasons
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ================================================
-- DEFAULT DATA SEEDING
-- ================================================

-- Insert default wearables (base items that all students get)
INSERT INTO wearables (id, name, slot, file_path, rarity, unlock_method, is_default) VALUES
('base_face_1', 'Default Face', 'BASE_FACE', '/avatars/base/faces/face_1.png', 'common', 'default', true),
('hair_1', 'Default Hair', 'HAIRSTYLE', '/avatars/hair/hair_1.png', 'common', 'default', true),
('top_1', 'Default Shirt', 'TOP', '/avatars/tops/shirt_1.png', 'common', 'default', true)
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON seasons TO anon, authenticated;
GRANT SELECT ON wearables TO anon, authenticated;
GRANT SELECT ON challenges TO anon, authenticated;
GRANT SELECT ON tournaments TO anon, authenticated;
GRANT SELECT ON tournament_participants TO anon, authenticated;
GRANT SELECT ON tournament_matches TO anon, authenticated;
GRANT SELECT ON blog_posts TO anon, authenticated;

-- Grant all permissions to authenticated users for their own data
GRANT ALL ON xp_transactions TO authenticated;
GRANT ALL ON student_wearables TO authenticated;
GRANT ALL ON student_avatars TO authenticated;
GRANT ALL ON friends TO authenticated;
GRANT ALL ON student_challenges TO authenticated;
GRANT ALL ON season_reports TO authenticated;

-- Grant admin permissions
GRANT ALL ON seasons TO authenticated;
GRANT ALL ON tournaments TO authenticated;
GRANT ALL ON tournament_participants TO authenticated;
GRANT ALL ON tournament_matches TO authenticated;
GRANT ALL ON blog_posts TO authenticated;
GRANT ALL ON wearables TO authenticated;
GRANT ALL ON challenges TO authenticated;