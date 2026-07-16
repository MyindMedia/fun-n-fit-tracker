-- Fix the parent_student_links foreign keys so Supabase joins work

-- 1. Change student_id column type from TEXT to UUID 
-- (Assuming the students table uses UUID for id, if it's TEXT, remove this statement)
ALTER TABLE public.parent_student_links 
ALTER COLUMN student_id TYPE UUID USING student_id::UUID;

-- 2. Add foreign key to students table
ALTER TABLE public.parent_student_links
ADD CONSTRAINT fk_student
FOREIGN KEY (student_id)
REFERENCES public.students(id)
ON DELETE CASCADE;

-- 3. Add foreign key to auth.users table
ALTER TABLE public.parent_student_links
ADD CONSTRAINT fk_parent
FOREIGN KEY (parent_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 4. Reload PostgREST schema cache so the API recognizes the relationships
NOTIFY pgrst, 'reload schema';
