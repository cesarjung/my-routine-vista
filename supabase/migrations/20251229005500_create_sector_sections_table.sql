-- Create sector_sections table
CREATE TABLE IF NOT EXISTS public.sector_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'dashboard', 'tasks', 'routines', 'units', 'custom_tasks', etc.
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.sector_sections ENABLE ROW LEVEL SECURITY;

-- Create policies (open for internal usage for now)
CREATE POLICY "Enable read access for all users" ON public.sector_sections
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.sector_sections
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.sector_sections
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.sector_sections
    FOR DELETE USING (auth.role() = 'authenticated');

-- Backfill existing sectors with default sections
DO $$
DECLARE
    sector_record RECORD;
BEGIN
    FOR sector_record IN SELECT id FROM public.sectors LOOP
        -- Dashboard
        INSERT INTO public.sector_sections (sector_id, title, type, order_index)
        VALUES (sector_record.id, 'Dashboard', 'dashboard', 0);

        -- Tasks
        INSERT INTO public.sector_sections (sector_id, title, type, order_index)
        VALUES (sector_record.id, 'Tarefas', 'tasks', 1);

        -- Routines
        INSERT INTO public.sector_sections (sector_id, title, type, order_index)
        VALUES (sector_record.id, 'Rotinas', 'routines', 2);

        -- Units
        INSERT INTO public.sector_sections (sector_id, title, type, order_index)
        VALUES (sector_record.id, 'Unidades', 'units', 3);
    END LOOP;
END $$;

-- Trigger to create default sections for NEW sectors automatically
CREATE OR REPLACE FUNCTION public.handle_new_sector_sections()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.sector_sections (sector_id, title, type, order_index)
    VALUES 
    (NEW.id, 'Dashboard', 'dashboard', 0),
    (NEW.id, 'Tarefas', 'tasks', 1),
    (NEW.id, 'Rotinas', 'routines', 2),
    (NEW.id, 'Unidades', 'units', 3);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sector_created
    AFTER INSERT ON public.sectors
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_sector_sections();
