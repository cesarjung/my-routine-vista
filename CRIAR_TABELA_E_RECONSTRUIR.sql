-- 1. CRIAR A TABELA FALTANTE NO BANCO DE DADOS
-- Este bloco recria a tabela que controla "quem faz o que" em cada rotina
CREATE TABLE IF NOT EXISTS public.routine_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(routine_id, user_id)
);

ALTER TABLE public.routine_assignees ENABLE ROW LEVEL SECURITY;

-- 2. RECRIAR AS PERMISSÕES DE SEGURANÇA (RLS)
DROP POLICY IF EXISTS "Admin pode gerenciar todos assignees de rotinas" ON public.routine_assignees;
CREATE POLICY "Admin pode gerenciar todos assignees de rotinas"
ON public.routine_assignees FOR ALL
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Gestor pode gerenciar assignees de rotinas da sua unidade" ON public.routine_assignees;
CREATE POLICY "Gestor pode gerenciar assignees de rotinas da sua unidade"
ON public.routine_assignees FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_assignees.routine_id 
  AND is_unit_manager(auth.uid(), r.unit_id)
));

DROP POLICY IF EXISTS "Usuario pode ver assignees de rotinas da sua unidade" ON public.routine_assignees;
CREATE POLICY "Usuario pode ver assignees de rotinas da sua unidade"
ON public.routine_assignees FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_assignees.routine_id 
  AND r.unit_id = get_user_unit_id(auth.uid())
));

-- 3. RECONSTRUIR O MOLDE COM OS DADOS DE 04/03 OU MAIS RECENTES
DO $$
BEGIN
    -- Limpa a tabela para termos um molde 100% novo (caso tenha sobrado lixo)
    DELETE FROM public.routine_assignees;

    -- Inserir os responsáveis principais (assigned_to)
    WITH LatestParentTasks AS (
        SELECT routine_id, MAX(created_at) as max_created_at
        FROM public.tasks
        WHERE parent_task_id IS NULL AND routine_id IS NOT NULL
        GROUP BY routine_id
    ),
    ValidParentTasks AS (
        SELECT t.id, t.routine_id
        FROM public.tasks t
        JOIN LatestParentTasks lpt 
          ON t.routine_id = lpt.routine_id AND t.created_at = lpt.max_created_at
    )
    INSERT INTO public.routine_assignees (routine_id, user_id)
    SELECT DISTINCT pt.routine_id, ct.assigned_to
    FROM public.tasks ct
    JOIN ValidParentTasks pt ON ct.parent_task_id = pt.id
    WHERE ct.assigned_to IS NOT NULL
    ON CONFLICT (routine_id, user_id) DO NOTHING;

    -- Tentar Inserir também os co-responsáveis, caso a task_assignees exista
    BEGIN
        EXECUTE '
        WITH LatestParentTasks AS (
            SELECT routine_id, MAX(created_at) as max_created_at
            FROM public.tasks
            WHERE parent_task_id IS NULL AND routine_id IS NOT NULL
            GROUP BY routine_id
        ),
        ValidParentTasks AS (
            SELECT t.id, t.routine_id
            FROM public.tasks t
            JOIN LatestParentTasks lpt ON t.routine_id = lpt.routine_id AND t.created_at = lpt.max_created_at
        )
        INSERT INTO public.routine_assignees (routine_id, user_id)
        SELECT DISTINCT pt.routine_id, ta.user_id
        FROM public.task_assignees ta
        JOIN public.tasks ct ON ta.task_id = ct.id
        JOIN ValidParentTasks pt ON ct.parent_task_id = pt.id
        ON CONFLICT (routine_id, user_id) DO NOTHING;
        ';
    EXCEPTION WHEN undefined_table THEN
        -- Ignora silenciosamente se a tabela task_assignees também não existir
        RAISE NOTICE 'task_assignees não existe, pulando co-responsáveis.';
    END;

END $$;
