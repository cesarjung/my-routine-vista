-- DIAGNÓSTICO DE GATILHOS V2 (CORRIGIDO)
-- Vamos caçar o código que quebra o login.

-- 1. Triggers na tabela AUTH.USERS (Isso roda quando atualiza o 'last_sign_in_at')
SELECT 
    trigger_name, 
    event_manipulation AS evento, 
    action_statement AS acao
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';

-- 2. Triggers na tabela PUBLIC.PROFILES (Isso pode rodar em cascata)
SELECT 
    trigger_name, 
    event_manipulation AS evento, 
    action_statement AS acao
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'profiles';

-- 3. Políticas de Segurança (RLS) no Auth
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'auth';

-- 4. Funções no Schema Auth (Pode ter algo estranho)
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'auth';
