-- Drop the incorrect policy
DROP POLICY IF EXISTS "Usuario pode ver setores atribuidos" ON public.sectors;

-- Create corrected policy: only admins see all, others see only their assigned sectors
CREATE POLICY "Usuario pode ver setores atribuidos" 
ON public.sectors 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_sector(auth.uid(), id)
);