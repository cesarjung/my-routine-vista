-- RECONSTRUIR O ESQUELETO MESTRE DE RESPONSÁVEIS DAS ROTINAS
-- Nova tentativa: este script usa PL/pgSQL explícito com SECURITY DEFINER (como superusuário)
-- para driblar qualquer problema de namespace ou RLS que o painel web SQL esteja sofrendo.

DO $$
BEGIN
    -- 1. Limpar tabela usando notação string segura
    EXECUTE 'DELETE FROM public.routine_assignees';

    -- 2. Inserir os responsáveis principais (assigned_to)
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
        JOIN LatestParentTasks lpt 
          ON t.routine_id = lpt.routine_id AND t.created_at = lpt.max_created_at
    )
    INSERT INTO public.routine_assignees (routine_id, user_id)
    SELECT DISTINCT pt.routine_id, ct.assigned_to
    FROM public.tasks ct
    JOIN ValidParentTasks pt ON ct.parent_task_id = pt.id
    WHERE ct.assigned_to IS NOT NULL
    ON CONFLICT (routine_id, user_id) DO NOTHING;
    ';

    -- 3. Inserir os co-responsáveis
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
    
    RAISE NOTICE 'Rotinas reconstruídas com sucesso!';
END $$;
