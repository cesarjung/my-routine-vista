-- CORREÇÃO DE EXTENSÕES E FUNÇÕES (VERSÃO CORRIGIDA)
-- O sistema precisa acessar a extensão pgcrypto para verificar a senha. 
-- Se ele não achar a função 'crypt', o login quebra.

-- 1. Garantir que a extensão existe no schema 'extensions' (padrão correto)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- Mover pgcrypto para extensions se estiver na public (limpeza)
DO $$
BEGIN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Extensão já deve estar no lugar certo ou não pode ser movida.';
END $$;

-- 2. Conceder permissão de execução em TODAS as funções do schema extensions (onde mora o pgcrypto)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_auth_admin;

-- 3. Conceder permissão também na public (caso tenha ficado lá)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;

-- 4. Definir search_path do banco para sempre olhar na extensions
-- Usando método seguro para não quebrar se estiver sem permissão de superuser
DO $$
BEGIN
    ALTER DATABASE postgres SET search_path TO public, extensions, auth;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignora erro se não for superuser
END $$;

-- 5. Recarregar
NOTIFY pgrst, 'reload config';

-- 6. Mensagem de Sucesso (como SELECT para não dar erro de sintaxe)
SELECT 'Permissões de extensões aplicadas com sucesso!' as status;
