-- ==========================================
-- Evaluate Feature: Schema Migration
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Add published_at column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS published_at timestamp with time zone DEFAULT NULL;

-- 2. Create submission_ratings table for peer evaluations
CREATE TABLE IF NOT EXISTS public.submission_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  rater_id text NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  rated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (submission_id, rater_id)
);

-- 3. Enable Row Level Security
ALTER TABLE public.submission_ratings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for submission_ratings
DROP POLICY IF EXISTS "Enable read access for all submission_ratings" ON public.submission_ratings;
CREATE POLICY "Enable read access for all submission_ratings" ON public.submission_ratings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all submission_ratings" ON public.submission_ratings;
CREATE POLICY "Enable insert access for all submission_ratings" ON public.submission_ratings
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all submission_ratings" ON public.submission_ratings;
CREATE POLICY "Enable update access for all submission_ratings" ON public.submission_ratings
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all submission_ratings" ON public.submission_ratings;
CREATE POLICY "Enable delete access for all submission_ratings" ON public.submission_ratings
    FOR DELETE USING (true);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_ratings;
