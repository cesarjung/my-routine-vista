-- Create table for custom dashboard panels
CREATE TABLE public.dashboard_panels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    panel_type text NOT NULL DEFAULT 'summary', -- 'summary', 'chart', etc.
    filters jsonb NOT NULL DEFAULT '{}', -- {sector_id, unit_id, status, period}
    display_config jsonb DEFAULT '{}', -- configuration for display (columns, order, etc.)
    order_index integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_panels ENABLE ROW LEVEL SECURITY;

-- Users can only see their own panels
CREATE POLICY "Users can view their own panels"
ON public.dashboard_panels
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own panels
CREATE POLICY "Users can create their own panels"
ON public.dashboard_panels
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own panels
CREATE POLICY "Users can update their own panels"
ON public.dashboard_panels
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own panels
CREATE POLICY "Users can delete their own panels"
ON public.dashboard_panels
FOR DELETE
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_dashboard_panels_updated_at
BEFORE UPDATE ON public.dashboard_panels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();