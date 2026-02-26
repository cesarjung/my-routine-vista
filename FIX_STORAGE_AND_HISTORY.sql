-- 1. Create the storage bucket 'task-attachments' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects if not already enabled (usually is)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for storage.objects (Attachments)
-- Allow public read access to the bucket
DROP POLICY IF EXISTS "Public Access task-attachments" ON storage.objects;
CREATE POLICY "Public Access task-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Authenticated Upload task-attachments" ON storage.objects;
CREATE POLICY "Authenticated Upload task-attachments"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'task-attachments');

-- Allow authenticated deletes (users can delete their own or all depending on requirement, usually just auth is enough for this app context)
DROP POLICY IF EXISTS "Authenticated Delete task-attachments" ON storage.objects;
CREATE POLICY "Authenticated Delete task-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments');


-- 4. Verify/Fix Routine History RLS
-- Ensure users can insert and select from routine_history
-- We simply re-run/ensure these are correct.

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.routine_history;
CREATE POLICY "Enable read access for authenticated users" ON public.routine_history
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.routine_history;
CREATE POLICY "Enable insert access for authenticated users" ON public.routine_history
    FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Fix Routine Comments RLS (just in case)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.routine_comments;
CREATE POLICY "Enable read access for authenticated users" ON public.routine_comments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.routine_comments;
CREATE POLICY "Enable insert access for authenticated users" ON public.routine_comments
    FOR INSERT TO authenticated WITH CHECK (true);
