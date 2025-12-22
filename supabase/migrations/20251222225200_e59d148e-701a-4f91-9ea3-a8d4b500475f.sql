-- Add policy to allow all authenticated users to see all units for routine creation
CREATE POLICY "Authenticated users can view all units for selection"
ON public.units
FOR SELECT
TO authenticated
USING (true);