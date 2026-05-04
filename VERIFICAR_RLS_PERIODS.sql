-- Checando as políticas RLS da tabela routine_periods
SELECT polname, polcmd, polroles, polqual, polwithcheck 
FROM pg_policy 
WHERE polrelid = 'public.routine_periods'::regclass;
