-- DIAGNÓSTICO DE GATILHOS (TRIGGERS) E POLÍTICAS NO AUTH
-- O login atualizou o horário de "last_sign_in_at", então a escrita FUNCIONOU.
-- O erro 500 acontece DEPOIS, provavelmente um gatilho escondido que dispara na atualização.

-- 1. Listar TODOS os triggers da tabela auth.users (especialmente UPDATE)
SELECT 
    trigger_name, 
    event_manipulation AS evento, 
    action_statement AS acao,
    action_orientation AS tipo
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';

-- 2. Listar Políticas de Segurança (RLS) na tabela auth (às vezes tem política bloqueando select pós-login)
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'auth';

-- 3. Ver se tem alguma função 'hook' perdida
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND naming_convention LIKE '%hook%'; -- Tentativa genérica
