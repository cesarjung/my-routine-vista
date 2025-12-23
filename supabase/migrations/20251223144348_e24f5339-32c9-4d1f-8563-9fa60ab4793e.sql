-- Drop existing policies on dashboard_panels
DROP POLICY IF EXISTS "Users can view their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Users can create their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Users can update their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Users can delete their own panels" ON public.dashboard_panels;

-- Create new policies: everyone can view all panels, only admins can manage
CREATE POLICY "Everyone can view all panels"
ON public.dashboard_panels
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can create panels"
ON public.dashboard_panels
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update panels"
ON public.dashboard_panels
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete panels"
ON public.dashboard_panels
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));