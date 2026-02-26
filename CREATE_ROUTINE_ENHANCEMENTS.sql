-- Modify checklist_items table to include routine_id
ALTER TABLE public.checklist_items 
ADD COLUMN IF NOT EXISTS routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE;

-- Drop existing constraint if it exists to update it
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_target_check;

-- Add updated constraint to ensure item belongs to task, subtask OR routine
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_target_check CHECK (
    (task_id IS NOT NULL AND subtask_id IS NULL AND routine_id IS NULL) OR
    (task_id IS NULL AND subtask_id IS NOT NULL AND routine_id IS NULL) OR
    (task_id IS NULL AND subtask_id IS NULL AND routine_id IS NOT NULL)
);

-- Index for routine checklists
CREATE INDEX IF NOT EXISTS idx_checklist_items_routine_id ON public.checklist_items(routine_id);


-- Create routine_attachments table
CREATE TABLE IF NOT EXISTS public.routine_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create routine_comments table
CREATE TABLE IF NOT EXISTS public.routine_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create routine_history table
CREATE TABLE IF NOT EXISTS public.routine_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'update', 'upload', 'checklist_add', 'checklist_complete'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.routine_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_history ENABLE ROW LEVEL SECURITY;

-- Create Policies (Simplified for now - authenticated users can read/write)

-- Routine Attachments
CREATE POLICY "Enable read access for authenticated users" ON public.routine_attachments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.routine_attachments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.routine_attachments
    FOR DELETE TO authenticated USING (true);

-- Routine Comments
CREATE POLICY "Enable read access for authenticated users" ON public.routine_comments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.routine_comments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.routine_comments
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.routine_comments
    FOR DELETE TO authenticated USING (true);

-- Routine History
CREATE POLICY "Enable read access for authenticated users" ON public.routine_history
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.routine_history
    FOR INSERT TO authenticated WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_routine_attachments_routine_id ON public.routine_attachments(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_comments_routine_id ON public.routine_comments(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_history_routine_id ON public.routine_history(routine_id);
