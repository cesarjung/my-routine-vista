-- SCRIPT PARA IMPLEMENTAR VISIBILIDADE (PÚBLICA/PRIVADA) E RLS

-- 1. ADICIONAR COLUNAS (is_private)
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.dashboard_panels ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;


-- ==========================================
-- 2. LIMITAR POLÍTICAS PARA TABLE: sectors
-- ==========================================
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Limpar previas (para nao dar conflito)
DROP POLICY IF EXISTS "Permitir tudo para autenticados em sectors" ON public.sectors;
DROP POLICY IF EXISTS "Enable read access for sectors" ON public.sectors;
DROP POLICY IF EXISTS "Enable insert access for sectors" ON public.sectors;
DROP POLICY IF EXISTS "Enable update access for sectors" ON public.sectors;
DROP POLICY IF EXISTS "Enable delete access for sectors" ON public.sectors;

CREATE POLICY "Enable read access for sectors" ON public.sectors FOR SELECT TO authenticated
USING (
    is_private = false 
    OR created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Enable insert access for sectors" ON public.sectors FOR INSERT TO authenticated
WITH CHECK (true); -- Permitimos criacao livre de novos

CREATE POLICY "Enable update access for sectors" ON public.sectors FOR UPDATE TO authenticated
USING (
    created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Enable delete access for sectors" ON public.sectors FOR DELETE TO authenticated
USING (
    created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);


-- ==========================================
-- 3. LIMITAR POLÍTICAS PARA TABLE: notes
-- ==========================================
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Limpar previas
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.notes;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.notes;
DROP POLICY IF EXISTS "Enable update access for users based on created_by" ON public.notes;
DROP POLICY IF EXISTS "Enable delete access for users based on created_by" ON public.notes;

CREATE POLICY "Enable read access for notes" ON public.notes FOR SELECT TO authenticated
USING (
    is_private = false 
    OR created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Enable insert access for notes" ON public.notes FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for notes" ON public.notes FOR UPDATE TO authenticated
USING (
    created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Enable delete access for notes" ON public.notes FOR DELETE TO authenticated
USING (
    created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);


-- ==========================================
-- 4. LIMITAR POLÍTICAS PARA TABLE: dashboard_panels
-- ==========================================
ALTER TABLE public.dashboard_panels ENABLE ROW LEVEL SECURITY;

-- Limpar previas
DROP POLICY IF EXISTS "Users can view their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Users can insert their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Users can update their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Users can delete their own panels" ON public.dashboard_panels;
DROP POLICY IF EXISTS "Admins can view all panels" ON public.dashboard_panels;

CREATE POLICY "Enable read access for dashboard_panels" ON public.dashboard_panels FOR SELECT TO authenticated
USING (
    is_private = false 
    OR user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Enable insert access for dashboard_panels" ON public.dashboard_panels FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for dashboard_panels" ON public.dashboard_panels FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Enable delete access for dashboard_panels" ON public.dashboard_panels FOR DELETE TO authenticated
USING (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
);

-- Force schema reload to pick up new columns instantly over the API
NOTIFY pgrst, 'reload config';
