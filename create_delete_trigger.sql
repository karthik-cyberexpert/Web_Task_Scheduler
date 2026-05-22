-- Run this script in your Supabase SQL Editor to set up automatic deletion of Firebase Auth users.

-- 1. Enable pg_net extension to allow HTTP requests from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the function that triggers when a user is deleted
CREATE OR REPLACE FUNCTION public.delete_firebase_user_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_header text;
BEGIN
  -- Safely extract Authorization header directly
  BEGIN
    auth_header := current_setting('request.header.authorization', true);
  EXCEPTION WHEN OTHERS THEN
    auth_header := NULL;
  END;

  -- Call the Supabase Edge Function asynchronously passing the deleted user's UID
  BEGIN
    PERFORM net.http_post(
      url := 'https://zlzwommicysvlgskjkns.supabase.co/functions/v1/delete-firebase-user',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', COALESCE(auth_header, '')
      ),
      body := jsonb_build_object('uid', old.uid)::text
    );
  EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger failure from blocking the database deletion
    RAISE WARNING 'Failed to trigger firebase user deletion: %', SQLERRM;
  END;

  RETURN old;
END;
$$;

-- 3. Bind the trigger to the users table
DROP TRIGGER IF EXISTS on_user_deleted ON public.users;
CREATE TRIGGER on_user_deleted
  BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.delete_firebase_user_trigger();

