-- Run this script in your Supabase SQL Editor to initialize or update your database schema with Row Level Security (RLS)

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.users (
  uid text primary key,
  email text not null,
  username text not null unique,
  name text not null,
  role text not null default 'user',
  xp integer not null default 0,
  onboarding boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  deadline timestamp with time zone not null,
  max_xp integer not null default 500,
  assigned_type text not null,
  assigned_users text[] not null default '{}',
  created_by_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null default 'active'
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  task_title text not null,
  user_id text not null references public.users(uid) on delete cascade,
  user_name text not null,
  user_email text not null,
  content text not null,
  status text not null default 'pending',
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  xp_awarded integer not null default 0,
  reviewed_at timestamp with time zone
);

-- Ensure onboarding column exists (for backward compatibility updates)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_until timestamp with time zone DEFAULT NULL;

-- Rename existing xp column to exp (preserves task points)
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'xp'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'exp'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN xp TO exp;
  END IF;
END $$;

-- Add the new xp column (leveling points)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;

-- Add optional leveling XP reward column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS xp_reward integer NOT NULL DEFAULT 0;

-- Add leveling XP awarded column to submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS level_xp_awarded integer NOT NULL DEFAULT 0;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for public.users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
CREATE POLICY "Enable read access for all users" ON public.users
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.users;
CREATE POLICY "Enable insert access for all users" ON public.users
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.users;
CREATE POLICY "Enable update access for all users" ON public.users
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.users;
CREATE POLICY "Enable delete access for all users" ON public.users
    FOR DELETE USING (true);

-- 4. RLS Policies for public.tasks
DROP POLICY IF EXISTS "Enable read access for all tasks" ON public.tasks;
CREATE POLICY "Enable read access for all tasks" ON public.tasks
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all tasks" ON public.tasks;
CREATE POLICY "Enable insert access for all tasks" ON public.tasks
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all tasks" ON public.tasks;
CREATE POLICY "Enable update access for all tasks" ON public.tasks
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all tasks" ON public.tasks;
CREATE POLICY "Enable delete access for all tasks" ON public.tasks
    FOR DELETE USING (true);

-- 5. RLS Policies for public.submissions
DROP POLICY IF EXISTS "Enable read access for all submissions" ON public.submissions;
CREATE POLICY "Enable read access for all submissions" ON public.submissions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all submissions" ON public.submissions;
CREATE POLICY "Enable insert access for all submissions" ON public.submissions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all submissions" ON public.submissions;
CREATE POLICY "Enable update access for all submissions" ON public.submissions
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all submissions" ON public.submissions;
CREATE POLICY "Enable delete access for all submissions" ON public.submissions
    FOR DELETE USING (true);

-- 6. Enable Realtime subscriptions
-- (Note: If these publications already exist or fail, they can be safely ignored)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- 7. Seed initial admin user
INSERT INTO public.users (uid, email, username, name, role, exp, xp, onboarding)
VALUES ('admin-init-uid', 'itzkarthik.cyber@gmail.com', 'admin', 'Admin Manager', 'admin', 0, 0, true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  onboarding = EXCLUDED.onboarding;

-- ==========================================
-- 8. Mini Jobs Schema Configuration
-- ==========================================

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  deadline timestamp with time zone not null,
  xp_reward integer not null default 50,
  assigned_type text not null,
  assigned_users text[] not null default '{}',
  created_by_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null default 'active',
  required_fields text[] not null default '{"textarea"}'
);

-- Create job_submissions table
CREATE TABLE IF NOT EXISTS public.job_submissions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_title text not null,
  user_id text not null references public.users(uid) on delete cascade,
  user_name text not null,
  user_email text not null,
  content text not null,
  status text not null default 'pending',
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  xp_awarded integer not null default 0,
  reviewed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_submissions ENABLE ROW LEVEL SECURITY;

-- Configure RLS Policies for jobs
DROP POLICY IF EXISTS "Enable read access for all jobs" ON public.jobs;
CREATE POLICY "Enable read access for all jobs" ON public.jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all jobs" ON public.jobs;
CREATE POLICY "Enable insert access for all jobs" ON public.jobs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all jobs" ON public.jobs;
CREATE POLICY "Enable update access for all jobs" ON public.jobs FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all jobs" ON public.jobs;
CREATE POLICY "Enable delete access for all jobs" ON public.jobs FOR DELETE USING (true);

-- Configure RLS Policies for job_submissions
DROP POLICY IF EXISTS "Enable read access for all job_submissions" ON public.job_submissions;
CREATE POLICY "Enable read access for all job_submissions" ON public.job_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all job_submissions" ON public.job_submissions;
CREATE POLICY "Enable insert access for all job_submissions" ON public.job_submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all job_submissions" ON public.job_submissions;
CREATE POLICY "Enable update access for all job_submissions" ON public.job_submissions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all job_submissions" ON public.job_submissions;
CREATE POLICY "Enable delete access for all job_submissions" ON public.job_submissions FOR DELETE USING (true);

-- Enable Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_submissions;

-- 8. Daily Rewards Columns on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_streak integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_claimed_at timestamp with time zone DEFAULT null;

-- ==========================================
-- 9. Levels / Leveling System
-- ==========================================

-- Create levels table
CREATE TABLE IF NOT EXISTS public.levels (
  id uuid primary key default gen_random_uuid(),
  level_name text not null,
  min_xp integer not null default 0,
  max_xp integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add current_level_id column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_level_id uuid DEFAULT null REFERENCES public.levels(id) ON DELETE SET NULL;

-- Enable RLS for levels
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all levels" ON public.levels;
CREATE POLICY "Enable read access for all levels" ON public.levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all levels" ON public.levels;
CREATE POLICY "Enable insert access for all levels" ON public.levels FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all levels" ON public.levels;
CREATE POLICY "Enable update access for all levels" ON public.levels FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all levels" ON public.levels;
CREATE POLICY "Enable delete access for all levels" ON public.levels FOR DELETE USING (true);

-- Enable Realtime for levels
ALTER PUBLICATION supabase_realtime ADD TABLE public.levels;

