-- Create tracker_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tracker_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE,
    filters JSONB DEFAULT '{"routines": [], "frequencies": []}'::jsonb,
    layouts JSONB DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tracker_settings_sector_id_key UNIQUE (sector_id)
);

-- Enable RLS
ALTER TABLE public.tracker_settings ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Everyone authenticated can read the settings
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.tracker_settings;
CREATE POLICY "Enable read access for authenticated users" ON public.tracker_settings
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update for their sector (We will strictly control the 'Gestor/Admin' role from the Frontend UI to simplify the SQL policy, but the insert itself is permitted if authenticated).
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.tracker_settings;
CREATE POLICY "Enable insert access for authenticated users" ON public.tracker_settings
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.tracker_settings;
CREATE POLICY "Enable update access for authenticated users" ON public.tracker_settings
    FOR UPDATE TO authenticated USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_tracker_settings_updated_at ON public.tracker_settings;
CREATE TRIGGER handle_tracker_settings_updated_at
  BEFORE UPDATE ON public.tracker_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Force schema reload at the end for PostgREST
NOTIFY pgrst, 'reload config';
