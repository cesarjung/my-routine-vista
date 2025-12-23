-- Create table for global dashboard layout (controlled by admins)
CREATE TABLE public.dashboard_layout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    panel_id text NOT NULL UNIQUE,
    position_x integer NOT NULL DEFAULT 0,
    position_y integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;

-- Everyone can view the layout
CREATE POLICY "Anyone can view dashboard layout"
ON public.dashboard_layout
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage the layout
CREATE POLICY "Only admins can insert layout"
ON public.dashboard_layout
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update layout"
ON public.dashboard_layout
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete layout"
ON public.dashboard_layout
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));