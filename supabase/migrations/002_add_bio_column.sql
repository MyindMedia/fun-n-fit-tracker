-- Add bio column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS bio TEXT;
