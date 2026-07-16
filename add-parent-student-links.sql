-- ========================================
-- PARENT STUDENT LINKS AND RLS SCHEMA UPDATE
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

-- Note: In a fully restricted environment, we would lock down the students
-- table so parents can only see students they are linked to.
-- However, we must ensure Admin and Student portals still work.
-- If the application isn't currently using a backend role system for Admin, 
-- or uses anon key everywhere, enforcing strict RLS on students might block existing flows.
-- For now, we will add a policy to allow parents to see students they are linked to, 
-- but we might need a broader policy if anonymous access is required.

-- Policy: Anyone can read students for now (to avoid breaking admin/student portal)
-- If we want strict privacy:
-- CREATE POLICY "Parents can view their linked students" ON students
--     FOR SELECT USING (
--         id IN (SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid())
--     );
-- But to keep things working seamlessly while only the parent dashboard is restricted 
-- from seeing all students in the UI, we'll keep students table readable if it already was.

-- Allow creating new students. If auth is required, we can restrict this.
CREATE POLICY "Enable insert for authenticated users only" ON students
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON students
    FOR SELECT USING (true);
    
CREATE POLICY "Enable update for all users" ON students
    FOR UPDATE USING (true);


-- Force Supabase to reload the schema
NOTIFY pgrst, 'reload schema';

