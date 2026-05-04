-- CORREÇÃO FINAL DE PERMISSÕES E SESSÕES (ERRO 500)
-- O login falha ao tentar criar a sessão (INSERT em auth.sessions) ou ao ler o schema auth.

-- 1. Garantir que o administrador do Supabase pode mexer no schema de autenticação
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;

-- 2. Limpar qualquer trigger que esteja travando a criação de Sessão
-- Se houver algum trigger "on_access_token_created" quebrado, ele mata o login aqui.
DROP TRIGGER IF EXISTS on_access_token_created ON auth.sessions;

-- 3. Garantir que a role de serviço e postgres tenham acesso
GRANT USAGE ON SCHEMA auth TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;

-- 4. Resetar dono das tabelas críticas (caso tenha sido alterado acidentalmente)
ALTER TABLE public.profiles OWNER TO postgres;

-- 5. Recarregar config
NOTIFY pgrst, 'reload config';
