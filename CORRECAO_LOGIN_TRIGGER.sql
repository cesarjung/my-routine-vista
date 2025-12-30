-- CORREÇÃO PROFUNDA DE TRIGGERS (CAUSE DE ERRO 500)
-- O login falha se existir um Trigger quebrado rodando na hora que o usuário conecta (UPDATE na tabela auth.users)

-- 1. Remover triggers antigos/problemáticos da tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_access_token_created ON auth.sessions;

-- 2. Recriar APENAS o trigger essencial de criação de perfil (INSERT)
-- Garantindo que ele roda com permissões de segurança corretas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'usuario')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Conceder permissão novamente (Reforço)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;

-- 4. Recarregar cache
NOTIFY pgrst, 'reload config';
