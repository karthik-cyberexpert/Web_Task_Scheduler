-- ==========================================
-- Supabase Full Database Schema & Configuration Setup
-- ==========================================

-- 1. Create Core Database Tables

CREATE TABLE IF NOT EXISTS public.users (
  uid text primary key,
  email text not null,
  username text not null unique,
  name text not null,
  role text not null default 'user',
  xp integer not null default 0,
  onboarding boolean not null default false,
  is_banned boolean not null default false,
  ban_reason text default null,
  suspended_until timestamp with time zone default null,
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
  status text not null default 'active',
  required_fields text[] not null default '{"textarea"}'
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

CREATE TABLE IF NOT EXISTS public.mail (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  text_body text not null,
  html_body text,
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.sent_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id text not null references public.users(uid) on delete cascade,
  reminder_type text not null, -- 'before_day' or 'on_day'
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE (task_id, user_id, reminder_type)
);

-- ==========================================
-- 2. Enable Row Level Security (RLS)
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_reminders ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. Row Level Security Policies
-- ==========================================

-- RLS Policies for public.users
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

-- RLS Policies for public.tasks
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

-- RLS Policies for public.submissions
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

-- RLS Policies for public.mail
DROP POLICY IF EXISTS "Enable select for all on mail" ON public.mail;
CREATE POLICY "Enable select for all on mail" ON public.mail
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all on mail" ON public.mail;
CREATE POLICY "Enable insert for all on mail" ON public.mail
    FOR INSERT WITH CHECK (true);

-- RLS Policies for public.sent_reminders
DROP POLICY IF EXISTS "Enable select for all on sent_reminders" ON public.sent_reminders;
CREATE POLICY "Enable select for all on sent_reminders" ON public.sent_reminders
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all on sent_reminders" ON public.sent_reminders;
CREATE POLICY "Enable insert for all on sent_reminders" ON public.sent_reminders
    FOR INSERT WITH CHECK (true);

-- ==========================================
-- 4. Enable Realtime Subscriptions
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- ==========================================
-- 5. Seed Initial Admin User
-- ==========================================

INSERT INTO public.users (uid, email, username, name, role, xp, onboarding)
VALUES ('admin-init-uid', 'itzkarthik.cyber@gmail.com', 'admin', 'Admin Manager', 'admin', 0, true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  onboarding = EXCLUDED.onboarding;

-- ==========================================
-- 6. Storage Bucket Configuration
-- ==========================================

-- Create the 'task-attachments' bucket in storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for 'task-attachments' bucket in storage.objects
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'task-attachments' );

DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;
CREATE POLICY "Public Delete Access"
ON storage.objects FOR DELETE
USING ( bucket_id = 'task-attachments' );
