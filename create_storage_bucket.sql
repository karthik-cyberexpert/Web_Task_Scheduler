-- 1. Add required_fields column to tasks table for submission format settings
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS required_fields text[] DEFAULT '{"textarea"}';

-- 2. Create the 'task-attachments' bucket in storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Create RLS Policies for 'task-attachments' bucket
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
