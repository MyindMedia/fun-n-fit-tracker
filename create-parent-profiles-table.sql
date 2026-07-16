-- Run this in Supabase SQL Editor to create the parent_profiles table

CREATE TABLE IF NOT EXISTS public.parent_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;

-- Allow parents to read/write their own profile
CREATE POLICY "Parents can view their own profile"
  ON public.parent_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Parents can update their own profile"
  ON public.parent_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Allow insert on signup"
  ON public.parent_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow service role full access
CREATE POLICY "Service role full access"
  ON public.parent_profiles FOR ALL
  USING (true);
