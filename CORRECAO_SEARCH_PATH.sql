-- CORREÇÃO DE SEARCH_PATH E PERMISSÕES (SALVA-VIDAS)
-- O erro "Database error querying schema" acontece pq o usuário do Auth não "enxerga" o schema public.

-- 1. Definir o caminho de busca (Search Path) para os usuários do sistema
ALTER ROLE supabase_auth_admin SET search_path TO public, auth, extensions;
ALTER ROLE postgres SET search_path TO public, auth, extensions;
ALTER ROLE authenticated SET search_path TO public, auth, extensions;
ALTER ROLE anon SET search_path TO public, auth, extensions;

-- 2. Garantir (de novo e com força) que o admin do auth pode ler TUDO no schema public
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin;

-- 3. Garantir que ele pode ler TUDO no schema auth também
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;

-- 4. Uma correção específica para triggers que usam funções da public
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;

-- 5. Recarregar configurações
NOTIFY pgrst, 'reload config';
