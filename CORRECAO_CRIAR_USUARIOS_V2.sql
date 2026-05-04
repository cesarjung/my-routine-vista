-- CORREÇÃO DEFINITIVA PARA CRIAÇÃO DE USUÁRIOS (V2)
-- Corrige o erro "function gen_salt does not exist"
-- Rode este comando no SQL Editor

-- 1. Garante que a extensão de criptografia existe no schema extensions (padrão Supabase)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Recria a função com o caminho de busca correto (incluindo 'extensions')
CREATE OR REPLACE FUNCTION public.create_user_admin(
  email text,
  password text,
  full_name text,
  role app_role,
  unit_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions -- ADICIONADO 'extensions' AQUI
AS $$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
BEGIN
  -- Verifica se email já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = create_user_admin.email) THEN
    RETURN json_build_object('error', 'Email já cadastrado');
  END IF;

  -- Criptografa a senha (agora vai achar a função gen_salt)
  encrypted_pw := crypt(password, gen_salt('bf'));

  -- Insere na tabela de autenticação (auth.users)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), -- gen_random_uuid também vem do pgcrypto ou nativo
    'authenticated',
    'authenticated',
    email,
    encrypted_pw,
    now(),
    jsonb_build_object('full_name', full_name),
    now(),
    now(),
    false
  ) RETURNING id INTO new_user_id;

  -- Trigger on_auth_user_created roda automaticamente aqui

  -- Atualizar a Role
  IF role IS DISTINCT FROM 'usuario' THEN
      UPDATE public.user_roles SET role = create_user_admin.role WHERE user_id = new_user_id;
  END IF;

  -- Inserir Unidades
  IF unit_ids IS NOT NULL AND array_length(unit_ids, 1) > 0 THEN
    INSERT INTO public.unit_managers (user_id, unit_id)
    SELECT new_user_id, unnest(unit_ids);
    
    UPDATE public.profiles SET unit_id = unit_ids[1] WHERE id = new_user_id;
  END IF;

  RETURN json_build_object('id', new_user_id, 'email', email);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;
