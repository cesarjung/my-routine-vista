-- DIAGRÓSTICO REALTIME E RLS 🕵️‍♂️📡
-- Vamos ver se o RLS (Segurança) está bloqueando as notificações ou se a publicação falhou.

-- 1. Verificar se as tabelas estão na publicação 'supabase_realtime'
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 2. Verificar se o RLS está ativo nas tabelas
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('tasks', 'routines', 'routine_checkins', 'subtasks');

-- 3. Listar Políticas (Policies) dessas tabelas
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename IN ('tasks', 'routines', 'routine_checkins', 'subtasks');
