-- Create checklist_items table
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    subtask_id UUID REFERENCES public.subtasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT checklist_target_check CHECK (
        (task_id IS NOT NULL AND subtask_id IS NULL) OR
        (task_id IS NULL AND subtask_id IS NOT NULL)
    )
);

-- Create task_attachments table (for main tasks)
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create task_comments table (for main tasks)
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create task_history table
CREATE TABLE IF NOT EXISTS public.task_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'status_change', 'comment', 'update', 'upload', 'checklist_add', 'checklist_complete'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- Create Policies (Simplified for now - authenticated users can read/write)
-- In a real scenario, you'd check for unit/sector access.

-- Checklist Items
CREATE POLICY "Enable read access for authenticated users" ON public.checklist_items
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.checklist_items
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.checklist_items
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.checklist_items
    FOR DELETE TO authenticated USING (true);

-- Task Attachments
CREATE POLICY "Enable read access for authenticated users" ON public.task_attachments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.task_attachments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.task_attachments
    FOR DELETE TO authenticated USING (true);

-- Task Comments
CREATE POLICY "Enable read access for authenticated users" ON public.task_comments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.task_comments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.task_comments
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.task_comments
    FOR DELETE TO authenticated USING (true);

-- Task History
CREATE POLICY "Enable read access for authenticated users" ON public.task_history
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.task_history
    FOR INSERT TO authenticated WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_checklist_items_task_id ON public.checklist_items(task_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_subtask_id ON public.checklist_items(subtask_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON public.task_history(task_id);
