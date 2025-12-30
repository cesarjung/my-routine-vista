-- DIAGNÓSTICO PROFUNDO (MODO RAIZ) 🔬
-- Vamos listar quem aponta para auth.users usando o catálogo interno do Postgres.
-- Isso NÃO TEM COMO mentir.

SELECT 
    conname as nome_da_regra, 
    conrelid::regclass as tabela_inimiga
FROM pg_constraint 
WHERE confrelid = 'auth.users'::regclass;
