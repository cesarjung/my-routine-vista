-- Forcefully fix the dashboard_layout table schema

-- 1. Add sector_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_layout' AND column_name = 'sector_id') THEN
        ALTER TABLE public.dashboard_layout ADD COLUMN sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Drop existing indexes to recreate them correctly (ensures no partial index conflicts)
DROP INDEX IF EXISTS dashboard_layout_user_panel_idx; -- Legacy index if exists
DROP INDEX IF EXISTS dashboard_layout_user_panel_global_idx;
DROP INDEX IF EXISTS dashboard_layout_user_panel_sector_idx;

-- 3. Create correct Partial Indexes for Uniqueness
-- For Global Dashboard (sector_id IS NULL)
CREATE UNIQUE INDEX dashboard_layout_user_panel_global_idx 
    ON public.dashboard_layout (user_id, panel_id) 
    WHERE sector_id IS NULL;

-- For Sector Dashboard (sector_id IS NOT NULL)
CREATE UNIQUE INDEX dashboard_layout_user_panel_sector_idx 
    ON public.dashboard_layout (user_id, sector_id, panel_id) 
    WHERE sector_id IS NOT NULL;

-- 4. Enable RLS (just in case)
ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;

-- 5. Refresh Policies
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

-- 6. Clean up orphans (Optional: remove layouts referencing non-existent sectors)
DELETE FROM public.dashboard_layout 
WHERE sector_id IS NOT NULL 
AND sector_id NOT IN (SELECT id FROM public.sectors);
