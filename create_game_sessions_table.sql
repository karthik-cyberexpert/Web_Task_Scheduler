-- ==========================================
-- Create Game Sessions Table SQL Script
-- ==========================================

CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    score INTEGER,
    details JSONB
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Enable read access for all game_sessions" ON public.game_sessions;
CREATE POLICY "Enable read access for all game_sessions" ON public.game_sessions
    FOR SELECT USING (true);

-- Insert policy
DROP POLICY IF EXISTS "Enable insert access for all game_sessions" ON public.game_sessions;
CREATE POLICY "Enable insert access for all game_sessions" ON public.game_sessions
    FOR INSERT WITH CHECK (true);

-- Update policy
DROP POLICY IF EXISTS "Enable update access for all game_sessions" ON public.game_sessions;
CREATE POLICY "Enable update access for all game_sessions" ON public.game_sessions
    FOR UPDATE USING (true);
