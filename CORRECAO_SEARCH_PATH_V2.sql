-- CORREÇÃO DE PERMISSÕES V2 (SEM MEXER EM ROLES RESERVADAS)
-- O admin não pode alterar o 'supabase_auth_admin', mas pode conceder permissões.

-- 1. Tentar definir o search_path a nível de BANCO DE DADOS (afeta todos os usuários)
-- Se der erro, o script continua.
DO $$
BEGIN
    ALTER DATABASE postgres SET search_path TO public, auth, extensions;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível alterar config do banco, continuando...';
END $$;

-- 2. Definir search_path apenas para roles que temos permissão
ALTER ROLE postgres SET search_path TO public, auth, extensions;
ALTER ROLE service_role SET search_path TO public, auth, extensions;
ALTER ROLE anon SET search_path TO public, auth, extensions;
ALTER ROLE authenticated SET search_path TO public, auth, extensions;

-- 3. Conceder permissões (O MAIS IMPORTANTE)
-- Garante que o Auth Admin consiga ler/escrever no schema public
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin;

-- 4. Garantir acesso ao schema auth para o Postgres (você)
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;

-- 5. Recarregar config
NOTIFY pgrst, 'reload config';
