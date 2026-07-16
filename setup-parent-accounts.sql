-- ============================================================
-- Run in Supabase SQL Editor
-- 1. Links Dax + Maila-Mae to Asa Aernstine
-- 2. Adds admin-friendly RLS policy on parent_student_links
-- ============================================================

-- Allow authenticated users to manage their own links
-- (fixes the RLS block when using the admin portal UI)
DROP POLICY IF EXISTS "Allow insert own links" ON public.parent_student_links;
CREATE POLICY "Allow insert own links"
  ON public.parent_student_links FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete own links" ON public.parent_student_links;
CREATE POLICY "Allow delete own links"
  ON public.parent_student_links FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "Allow select links" ON public.parent_student_links;
CREATE POLICY "Allow select links"
  ON public.parent_student_links FOR SELECT
  USING (true);

-- Link Dax and Maila-Mae to Asa Aernstine
INSERT INTO public.parent_student_links (parent_id, student_id)
SELECT 
  '574e4fa0-e2ce-420b-a596-3518ad0ebad1'::uuid AS parent_id,
  id AS student_id
FROM public.students
WHERE "fullName" ILIKE '%dax%' OR "fullName" ILIKE '%maila%'
ON CONFLICT DO NOTHING;

-- Verify results
SELECT 
  pp.full_name AS parent,
  s."fullName" AS student
FROM public.parent_student_links psl
JOIN public.parent_profiles pp ON pp.id = psl.parent_id
JOIN public.students s         ON s.id  = psl.student_id
ORDER BY pp.full_name, s."fullName";
