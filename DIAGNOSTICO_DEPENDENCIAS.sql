-- RASTREADOR DE VÍNCULOS (QUEM SEGURA O USUÁRIO?) 🕵️‍♂️🔗
-- Este script vai listar TODAS as tabelas que têm link com auth.users.
-- Se deleção falha, é culpa de uma delas.

SELECT
    tc.table_schema || '.' || tc.table_name as tabela_chiliquenta,
    kcu.column_name as coluna_fk,
    tc.constraint_name as nome_regra
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE ccu.table_name = 'users' AND ccu.table_schema = 'auth';
