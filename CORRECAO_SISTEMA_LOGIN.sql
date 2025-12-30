-- CORREÇÃO DE ACESSO AO SCHEMA DO SISTEMA (VERSÃO SEGURA)
-- O erro "database error querying schema" significa que o sistema não vê as tabelas.

-- 1. Conceder permissão de leitura nos catálogos do sistema
-- (Isso é permitido para gestores do banco)
GRANT USAGE ON SCHEMA information_schema TO supabase_auth_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO supabase_auth_admin;

GRANT USAGE ON SCHEMA pg_catalog TO supabase_auth_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO supabase_auth_admin;

-- 2. Conceder acesso explícito para SELECT na tabela users (do Auth)
GRANT SELECT ON TABLE auth.users TO supabase_auth_admin;
GRANT SELECT ON TABLE auth.sessions TO supabase_auth_admin;

-- 3. DIAGNÓSTICO DE CONFLITO (A PARTE MAIS IMPORTANTE)
-- Verifica se você criou sem querer uma tabela 'users' na pasta pública.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        -- SE APARECER ESTE ERRO ABAIXO, É O MOTIVO DE TUDO ESTAR QUEBRADO:
        RAISE EXCEPTION 'PERIGO: Existe uma tabela chamada public.users! Isso confunde o sistema. Renomeie para public.profiles.';
    ELSE
        RAISE NOTICE 'Verificação OK: Não existe tabela public.users conflitando.';
    END IF;
END $$;

-- 4. Tentar garantir Search Path do BANCO (afeta todos) de forma segura
DO $$
BEGIN
    ALTER DATABASE postgres SET search_path TO public, auth, extensions;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Segue o baile se não der
END $$;

-- 5. Recarregar
NOTIFY pgrst, 'reload config';

SELECT 'Permissões aplicadas e diagnóstico finalizado.' as status;
