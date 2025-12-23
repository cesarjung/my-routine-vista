-- Create sector_users table to link users to sectors
CREATE TABLE public.sector_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(sector_id, user_id)
);

-- Enable RLS on sector_users
ALTER TABLE public.sector_users ENABLE ROW LEVEL SECURITY;

-- Admin can manage all sector_users
CREATE POLICY "Admin pode gerenciar usuarios de setores"
ON public.sector_users
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Gestor can view sector_users for sectors they belong to
CREATE POLICY "Gestor pode ver usuarios do setor"
ON public.sector_users
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor') AND
  EXISTS (
    SELECT 1 FROM public.sector_users su
    WHERE su.sector_id = sector_users.sector_id
    AND su.user_id = auth.uid()
  )
);

-- Users can view their own sector assignments
CREATE POLICY "Usuario pode ver suas atribuicoes de setor"
ON public.sector_users
FOR SELECT
USING (user_id = auth.uid());

-- Create helper function to check if user has access to sector
CREATE OR REPLACE FUNCTION public.user_has_sector_access(_user_id UUID, _sector_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sector_users
    WHERE user_id = _user_id AND sector_id = _sector_id
  ) OR has_role(_user_id, 'admin')
$$;

-- Drop old SELECT policy for sectors
DROP POLICY IF EXISTS "Usuarios autenticados podem ver setores" ON public.sectors;

-- Create new SELECT policy - users can only see sectors they're assigned to
CREATE POLICY "Usuario pode ver setores atribuidos"
ON public.sectors
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gestor') OR
  EXISTS (
    SELECT 1 FROM public.sector_users
    WHERE sector_users.sector_id = sectors.id
    AND sector_users.user_id = auth.uid()
  )
);