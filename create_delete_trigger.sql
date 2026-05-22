-- Run this script in your Supabase SQL Editor to set up automatic deletion of Firebase Auth users.

-- 1. Enable pg_net extension to allow HTTP requests from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the function that triggers when a user is deleted
CREATE OR REPLACE FUNCTION public.delete_firebase_user_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the Supabase Edge Function asynchronously passing the deleted user's UID
  PERFORM net.http_post(
    url := 'https://zlzwommicysvlgskjkns.supabase.co/functions/v1/delete-firebase-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.headers', true)::jsonb->>'authorization'
    ),
    body := jsonb_build_object('uid', old.uid)::text
  );
  RETURN old;
END;
$$;

-- 3. Bind the trigger to the users table
DROP TRIGGER IF EXISTS on_user_deleted ON public.users;
CREATE TRIGGER on_user_deleted
  BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.delete_firebase_user_trigger();
