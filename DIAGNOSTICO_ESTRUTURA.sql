-- DIAGNÓSTICO DE ESTRUTURA E PROPRIEDADE
-- Se este script mostrar muitos "postgres" onde deveria estar "supabase_admin",
-- significa que o banco foi restaurado incorretamente.

-- 1. Quem é o dono dos schemas?
-- Esperado: auth -> supabase_admin (ou postgres em self-hosted antigo)
SELECT n.nspname AS schema, u.usename AS owner
FROM pg_namespace n JOIN pg_user u ON n.nspowner = u.usesysid
WHERE n.nspname IN ('auth', 'public', 'extensions');

-- 2. Quem é o dono das tabelas do auth?
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'auth';

-- 3. Verificando colunas da tabela users (para ver se falta algo crítico)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
LIMIT 10;
