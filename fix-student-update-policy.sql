-- Policy: Allow parents to update the students they are linked to
CREATE POLICY "Parents can update their linked students" 
ON public.students
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM parent_student_links
        WHERE parent_student_links.student_id = students.id
        AND parent_student_links.parent_id = auth.uid()
    )
);

-- Note: Also ensure they can see their students (just in case this was missing too)
DROP POLICY IF EXISTS "Parents can view their linked students" ON public.students;
CREATE POLICY "Parents can view their linked students" 
ON public.students
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM parent_student_links
        WHERE parent_student_links.student_id = students.id
        AND parent_student_links.parent_id = auth.uid()
    )
);

-- Note: Allow parents to insert students (might be needed for enrollment if not using a service rol)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.students;
CREATE POLICY "Enable insert for authenticated users only" 
ON public.students
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Reload schema cache to apply policies immediately
NOTIFY pgrst, 'reload schema';
