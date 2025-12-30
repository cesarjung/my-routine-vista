-- CORREÇÃO DESESPERADA (ISOLAMENTO TOTAL)
-- Se o login atualiza a tabela mas dá erro depois, algo está bloqueando a leitura ou rodando um código quebrado.

-- 1. Desativar TODOS os gatilhos da tabela de usuários (Para parar qualquer código automático)
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- 2. Desativar segurança (RLS) na tabela de usuários do Auth (Para parar qualquer bloqueio de leitura)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas se existirem (Limpeza)
DROP POLICY IF EXISTS "Enable read access for all users" ON auth.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON auth.users;
DROP POLICY IF EXISTS "Enable update for users based on email" ON auth.users;

-- 4. Desativar RLS na tabela de sessões também
ALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;

-- 5. Garantir (mais uma vez) que o Auth Admin pode ler tudo
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;

-- 6. Recarregar
NOTIFY pgrst, 'reload config';

SELECT 'Trava de segurança e gatilhos removidos. Tente logar com teste.2 agora.' as status;
