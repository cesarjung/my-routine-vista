-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Gestor pode ver usuarios do setor" ON public.sector_users;

-- Create a security definer function to check if user belongs to a sector
CREATE OR REPLACE FUNCTION public.user_belongs_to_sector(_user_id UUID, _sector_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sector_users
    WHERE user_id = _user_id AND sector_id = _sector_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Gestor pode ver usuarios do setor"
ON public.sector_users
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor') AND
  user_belongs_to_sector(auth.uid(), sector_id)
);

-- Also update the sectors policy to use the new function
DROP POLICY IF EXISTS "Usuario pode ver setores atribuidos" ON public.sectors;

CREATE POLICY "Usuario pode ver setores atribuidos"
ON public.sectors
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gestor') OR
  user_belongs_to_sector(auth.uid(), id)
);