-- Create dashboard_panels table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.dashboard_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    panel_type TEXT NOT NULL, -- 'summary', 'custom', 'chart', etc.
    filters JSONB DEFAULT '{}'::jsonb,
    display_config JSONB DEFAULT '{}'::jsonb,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.dashboard_panels ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS "Users can view their own panels" ON public.dashboard_panels;
CREATE POLICY "Users can view their own panels" ON public.dashboard_panels
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own panels" ON public.dashboard_panels;
CREATE POLICY "Users can insert their own panels" ON public.dashboard_panels
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own panels" ON public.dashboard_panels;
CREATE POLICY "Users can update their own panels" ON public.dashboard_panels
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own panels" ON public.dashboard_panels;
CREATE POLICY "Users can delete their own panels" ON public.dashboard_panels
    FOR DELETE USING (auth.uid() = user_id);

-- Also allow admins to view all panels (optional, but good for management)
-- CREATE POLICY "Admins can view all panels" ON public.dashboard_panels
--    FOR SELECT USING (public.is_admin());

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_dashboard_panels_updated_at ON public.dashboard_panels;
CREATE TRIGGER handle_dashboard_panels_updated_at
  BEFORE UPDATE ON public.dashboard_panels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Force schema reload at the end
NOTIFY pgrst, 'reload config';
