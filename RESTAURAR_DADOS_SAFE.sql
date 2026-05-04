-- RESTAURAR DADOS SAFE (CORRIGIDO V2) 🤕💊
-- Removido checkin_id que não existe na tabela tasks.

BEGIN;

    -- 1. Restaurar Tarefas para os novos IDs
    INSERT INTO public.tasks (
        title, 
        description, 
        status, 
        priority, 
        due_date, 
        assigned_to, -- Mágica aqui
        routine_id,
        created_at,
        updated_at
        -- checkin_id REMOVIDO
    )
    SELECT 
        b.title, 
        b.description, 
        b.status, 
        b.priority, 
        b.due_date, 
        u.id, -- Pega o NOVO ID do usuário que tem o mesmo email
        b.routine_id,
        b.created_at,
        now()
        -- b.checkin_id REMOVIDO
    FROM public.backup_tasks_phoenix b
    JOIN auth.users u ON b.old_assignee_email = u.email;

    -- 2. Restaurar Checkins
    INSERT INTO public.routine_checkins (
        routine_id,
        user_id,
        status,
        check_date,
        created_at,
        completion_metadata,
        notes
    )
    SELECT 
        b.routine_id,
        u.id, -- Novo ID
        b.status,
        b.check_date,
        b.created_at,
        b.completion_metadata,
        b.notes
    FROM public.backup_checkins_phoenix b
    JOIN auth.users u ON b.user_email = u.email;

COMMIT;

SELECT count(*) as tarefas_recuperadas FROM public.tasks;
