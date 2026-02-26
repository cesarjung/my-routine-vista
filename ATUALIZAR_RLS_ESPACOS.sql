-- CRIAÇÃO DA TABELA DE VÍNCULOS DE ESPAÇOS (sector_users) CASO NÃO EXISTA
CREATE TABLE IF NOT EXISTS public.sector_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(sector_id, user_id)
);

-- POLÍTICAS RLS PARA ESPAÇOS (sectors) E SEUS USUÁRIOS (sector_users)

-- Habilitar RLS se não estiver
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_users ENABLE ROW LEVEL SECURITY;

-- Remove antigas políticas que podem dar visão total de setores a todos
DROP POLICY IF EXISTS "Usuários podem ver todos os setores" ON public.sectors;
DROP POLICY IF EXISTS "Apenas admins podem criar setores" ON public.sectors;
DROP POLICY IF EXISTS "Apenas admins podem atualizar setores" ON public.sectors;
DROP POLICY IF EXISTS "Apenas admins podem deletar setores" ON public.sectors;

-- Remove novas políticas caso este script precise ser executado de novo
DROP POLICY IF EXISTS "Visualização restrita de espaços" ON public.sectors;
DROP POLICY IF EXISTS "Qualquer usuário logado pode criar espaços" ON public.sectors;
DROP POLICY IF EXISTS "Admins ou Criadores podem atualizar espaços" ON public.sectors;
DROP POLICY IF EXISTS "Admins ou Criadores podem deletar espaços" ON public.sectors;

-- 1. SELECT na tabela SECTORS (Espaços)
-- O usuário pode ver o Espaço se:
-- a) Ele for admin ('admin' na tabela user_roles)
-- b) O espaço for público (is_private = false ou nulo)
-- c) Ele for o criador do espaço (created_by = auth.uid())
-- d) Ele tiver sido adicionado ao espaço (estiver na tabela sector_users)
CREATE POLICY "Visualização restrita de espaços" ON public.sectors FOR SELECT USING (
  is_private = false OR is_private IS NULL
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.sector_users su 
    WHERE su.sector_id = sectors.id AND su.user_id = auth.uid()
  )
);

-- 2. INSERT na tabela SECTORS (Espaços)
-- Qualquer usuário logado pode criar um espaço novo
CREATE POLICY "Qualquer usuário logado pode criar espaços" ON public.sectors FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 3. UPDATE na tabela SECTORS (Espaços)
-- O usuário gerencia o Espaço se:
-- a) Ele for admin
-- b) Ele for o criador (created_by)
-- c) Ele for Gestor e puder visualizar este espaço (público ou convidado)
CREATE POLICY "Admins ou Criadores podem atualizar espaços" ON public.sectors FOR UPDATE USING (
  public.can_manage_sector(id)
);

-- 4. DELETE na tabela SECTORS (Espaços)
-- Só o admin ou o criador deleta o espaço
CREATE POLICY "Admins ou Criadores podem deletar espaços" ON public.sectors FOR DELETE USING (
  public.can_manage_sector(id)
);

-- FUNÇÃO AUXILIAR PARA EVITAR RECURSÃO E CENTRALIZAR PERMISSÃO DE GERENCIAMENTO
CREATE OR REPLACE FUNCTION public.can_manage_sector(check_sector_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sectors s
    WHERE s.id = check_sector_id
    AND (
      s.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
        )
        AND (
          s.is_private = false OR s.is_private IS NULL
          OR EXISTS (
            SELECT 1 FROM public.sector_users su 
            WHERE su.sector_id = check_sector_id AND su.user_id = auth.uid()
          )
        )
      )
    )
  );
$$;

-- POLÍTICAS PARA SECTOR_USERS (Vínculos de usuários aos Espaços Compartilhados)

DROP POLICY IF EXISTS "Usuários podem ver vínculos" ON public.sector_users;
DROP POLICY IF EXISTS "Somente admins gerenciam vínculos" ON public.sector_users;

-- Remove novas políticas caso este script precise ser rodado novamente
DROP POLICY IF EXISTS "Visualização de vínculos no espaço" ON public.sector_users;
DROP POLICY IF EXISTS "Admins e Donos gerenciam vínculos" ON public.sector_users;
DROP POLICY IF EXISTS "Admins e Donos removem vínculos" ON public.sector_users;

-- SELECT em sector_users:
-- a) Admin vê tudo
-- b) O usuário vê os vínculos de um espaço no qual ele tá inserido
-- c) O usuário criado do espaço vê tudo
CREATE POLICY "Visualização de vínculos no espaço" ON public.sector_users FOR SELECT USING (
  user_id = auth.uid()
  OR public.can_manage_sector(sector_id)
);

-- INSERT/DELETE em sector_users
-- Só admin ou o dono do Espaço pode dar e tirar acesso de outros usuários
CREATE POLICY "Admins e Donos gerenciam vínculos" ON public.sector_users FOR INSERT WITH CHECK (
  public.can_manage_sector(sector_id)
);

CREATE POLICY "Admins e Donos removem vínculos" ON public.sector_users FOR DELETE USING (
  public.can_manage_sector(sector_id)
);
