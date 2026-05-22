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

-- 6. Enable Realtime subscriptions
-- (Note: If these publications already exist or fail, they can be safely ignored)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- 7. Seed initial admin user
INSERT INTO public.users (uid, email, username, name, role, xp, onboarding)
VALUES ('admin-init-uid', 'itzkarthik.cyber@gmail.com', 'admin', 'Admin Manager', 'admin', 0, true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  onboarding = EXCLUDED.onboarding;
