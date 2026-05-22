-- 1. Create the mail table to store outgoing emails (used by Supabase trigger systems)
CREATE TABLE IF NOT EXISTS public.mail (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  text_body text not null,
  html_body text,
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create the sent_reminders table to prevent duplicate deadline alert emails
CREATE TABLE IF NOT EXISTS public.sent_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id text not null references public.users(uid) on delete cascade,
  reminder_type text not null, -- 'before_day' or 'on_day'
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE (task_id, user_id, reminder_type)
);

-- 3. Enable RLS on public.mail
ALTER TABLE public.mail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for all on mail" ON public.mail;
CREATE POLICY "Enable select for all on mail" ON public.mail
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all on mail" ON public.mail;
CREATE POLICY "Enable insert for all on mail" ON public.mail
    FOR INSERT WITH CHECK (true);

-- 4. Enable RLS on public.sent_reminders
ALTER TABLE public.sent_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for all on sent_reminders" ON public.sent_reminders;
CREATE POLICY "Enable select for all on sent_reminders" ON public.sent_reminders
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all on sent_reminders" ON public.sent_reminders;
CREATE POLICY "Enable insert for all on sent_reminders" ON public.sent_reminders
    FOR INSERT WITH CHECK (true);
