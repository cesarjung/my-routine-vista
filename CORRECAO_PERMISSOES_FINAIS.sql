-- CORREÇÃO DE PERMISSÕES FINAIS (O TUDO OU NADA)
-- Já que não conseguimos simular, vamos garantir que o Auth tenha permissão TOTAL de escrita.

-- 1. Resetar Senha do Teste (Garantia Absoluta)
UPDATE auth.users 
SET encrypted_password = crypt('123456', gen_salt('bf')), 
    email_confirmed_at = now() 
WHERE email = 'teste.2@sirtec.com.br';

-- 2. Conceder TODOS os poderes no schema AUTH
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- 3. Conceder TODOS os poderes no schema PUBLIC (necessário para Trigger e Profiles)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin;

-- 4. Conceder TODOS os poderes no schema EXTENSIONS (pgcrypto etc)
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO supabase_auth_admin;

-- 5. Recarregar Configurações
NOTIFY pgrst, 'reload config';

SELECT 'Permissões Totais Aplicadas. Senha do teste.2 resetada para 123456.' as status;
