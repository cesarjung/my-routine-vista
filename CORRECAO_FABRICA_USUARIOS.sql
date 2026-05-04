-- CORREÇÃO DA FÁBRICA DE USUÁRIOS (VERSÃO BLINDADA) 🛡️
-- Esta versão corrige os problemas que causavam erro 500 no login:
-- 1. Usa o instance_id REAL do banco (não fixo em 0000...)
-- 2. Define o provider_id na tabela identities como o ID DO USUÁRIO (padrão mais seguro)
-- 3. Usa NULL para tokens não usados (evita erros de string vazia)

CREATE OR REPLACE FUNCTION public.create_user_admin(email text, password text, full_name text, role app_role, unit_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
  real_instance_id uuid;
BEGIN
  -- 0. Busca o Instance ID real
  SELECT id INTO real_instance_id FROM auth.instances LIMIT 1;
  IF real_instance_id IS NULL THEN
     real_instance_id := '00000000-0000-0000-0000-000000000000'; -- Fallback
  END IF;

  -- 1. Verifica duplicidade
  IF EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = create_user_admin.email) THEN
    RETURN json_build_object('error', 'Email já cadastrado');
  END IF;

  -- 2. Criptografa senha (Bcrypt é aceito pela maioria, se falhar, avisar)
  encrypted_pw := crypt(password, gen_salt('bf', 10));

  -- 3. INSERE USER COM METADATA E TOKENS LIMPOS
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone_change_token,
    created_at,
    updated_at,
    is_sso_user
  ) VALUES (
    real_instance_id,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    encrypted_pw,
    now(),
    jsonb_build_object('full_name', full_name),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NULL, NULL, NULL, NULL, NULL, -- USANDO NULL PARA EVITAR ERROS
    now(),
    now(),
    false
  ) RETURNING id INTO new_user_id;

  -- 4. INSERE IDENTIDADE (CORREÇÃO DE PROVIDER ID)
  -- Usa new_user_id como provider_id para garantir compatibilidade
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', email, 'email_verified', true, 'provider_id', new_user_id::text),
    'email',
    new_user_id::text, -- AQUI: ID do User, não Email
    now(),
    now(),
    now()
  );

  -- 5. Atualiza Função (Role) direto no Profile
  IF role IS DISTINCT FROM 'usuario' THEN
      UPDATE public.profiles SET role = create_user_admin.role WHERE id = new_user_id;
  END IF;

  -- 6. Unidades
  IF unit_ids IS NOT NULL AND array_length(unit_ids, 1) > 0 THEN
    INSERT INTO public.unit_managers (user_id, unit_id)
    SELECT new_user_id, unnest(unit_ids);
    
    UPDATE public.profiles SET unit_id = unit_ids[1] WHERE id = new_user_id;
  END IF;

  RETURN json_build_object('id', new_user_id, 'email', email);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$function$;

SELECT 'Função create_user_admin BLINDADA aplicada com sucesso.' as status;
