-- Checando TODAS as políticas RLS das tabelas envolvidas na criação de um período

SELECT polrelid::regclass::text AS table_name, polname, polcmd, polroles, polqual, polwithcheck 
FROM pg_policy 
WHERE polrelid IN (
    'public.routine_periods'::regclass,
    'public.tasks'::regclass,
    'public.routine_checkins'::regclass,
    'public.task_assignees'::regclass
)
ORDER BY table_name, polname;
