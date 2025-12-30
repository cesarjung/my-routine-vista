-- CORREÇÃO DE ERRO 500 NO LOGIN (DATABASE ERROR QUERYING SCHEMA)
-- Esse erro ocorre quando o sistema de Auth não tem permissão para ler o schema 'public'
-- ou quando algum trigger falha silenciosamente.

-- 1. Conceder permissões explícitas para o administrador de Auth do Supabase
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO supabase_auth_admin;

-- 2. Reforçar permissões padrão para roles do sistema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Recriar Trigger de Novos Usuários (Versão Segura)
-- Isso evita que o login falhe se o perfil já existir
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'usuario')
  ON CONFLICT (id) DO NOTHING; -- Se já existe, não faz nada (evita erro)
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recarregar o cache do Schema
NOTIFY pgrst, 'reload config';
