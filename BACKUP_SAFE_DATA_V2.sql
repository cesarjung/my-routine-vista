-- BACKUP DE SEGURANÇA CORRIGIDO (PROTOCOLO FÊNIX V2) 🛡️
-- Coluna correta: assigned_to

BEGIN;

    -- 1. Backup das Tarefas (Tasks)
    DROP TABLE IF EXISTS public.backup_tasks_phoenix;
    CREATE TABLE public.backup_tasks_phoenix AS
    SELECT 
        t.*,
        u.email as old_assignee_email
    FROM public.tasks t
    JOIN auth.users u ON t.assigned_to = u.id; -- Coluna corrigida

    -- 2. Backup dos Checkins de Rotina
    DROP TABLE IF EXISTS public.backup_checkins_phoenix;
    CREATE TABLE public.backup_checkins_phoenix AS
    SELECT 
        c.*,
        u.email as user_email
    FROM public.routine_checkins c
    JOIN auth.users u ON c.user_id = u.id;

COMMIT;

SELECT 
    (SELECT count(*) FROM public.backup_tasks_phoenix) as tarefas_guardadas,
    (SELECT count(*) FROM public.backup_checkins_phoenix) as checkins_guardados;
