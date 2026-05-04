-- Create dashboard_layout table if not exists with correct structure
CREATE TABLE IF NOT EXISTS public.dashboard_layout (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE, -- Nullable for Global Dashboard
    panel_id TEXT NOT NULL,
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own layouts" ON public.dashboard_layout;
CREATE POLICY "Users can view their own layouts" ON public.dashboard_layout
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own layouts" ON public.dashboard_layout;
CREATE POLICY "Users can insert their own layouts" ON public.dashboard_layout
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own layouts" ON public.dashboard_layout;
CREATE POLICY "Users can update their own layouts" ON public.dashboard_layout
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own layouts" ON public.dashboard_layout;
CREATE POLICY "Users can delete their own layouts" ON public.dashboard_layout
    FOR DELETE USING (auth.uid() = user_id);

-- Create unique index to prevent duplicates per user/sector/panel
-- We treat NULL sector_id as 'global'
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_user_panel_global_idx 
    ON public.dashboard_layout (user_id, panel_id) 
    WHERE sector_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_user_panel_sector_idx 
    ON public.dashboard_layout (user_id, sector_id, panel_id) 
    WHERE sector_id IS NOT NULL;


-- Fix Sector Sections types
-- This fixes the issue where "Dashboard" inside a sector behaves like "Tasks"
-- because it likely has the wrong type in the database.

-- 1. Ensure 'Dashboard' sections have type 'dashboard'
UPDATE public.sector_sections 
SET type = 'dashboard' 
WHERE title = 'Dashboard' AND type != 'dashboard';

-- 2. Ensure 'Tarefas' sections have type 'tasks'
UPDATE public.sector_sections 
SET type = 'tasks' 
WHERE title = 'Tarefas' AND type != 'tasks';

-- 3. Ensure 'Rotinas' sections have type 'routines'
UPDATE public.sector_sections 
SET type = 'routines' 
WHERE title = 'Rotinas' AND type != 'routines';

-- 4. Ensure 'Unidades' sections have type 'units'
UPDATE public.sector_sections 
SET type = 'units' 
WHERE title = 'Unidades' AND type != 'units';

-- Optional: Insert missing default sections for existing sectors if they don't exist
-- (This is complex in SQL only, assuming the app handles creation or they exist but were wrong)
