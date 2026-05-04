-- LISTAR TRIGGERS ATIVOS NA TABELA auth.users
-- Este script vai nos mostrar o que o banco tenta rodar quando um usuário faz login.
-- O erro 500 provavelmente vem de um desses triggers falhando.

SELECT 
    trigger_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users';

