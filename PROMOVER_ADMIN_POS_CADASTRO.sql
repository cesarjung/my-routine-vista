-- PROMOVER NOVO ADMIN 👑
-- Depois que você criar o usuário pelo botão "Cadastro", rode este script.
-- Ele vai VALIDAR o email automaticamente e dar PERMISSÃO DE ADMIN.

BEGIN;

    -- 1. Confirma o email (para não pedir verificação)
    UPDATE auth.users
    SET email_confirmed_at = now(),
        confirmed_at = now(),
        last_sign_in_at = now(),
        raw_app_meta_data = jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email']
        )
    WHERE email = 'cesar.jung@sirtec.com.br';

    -- 2. Garante que é ADMIN na tabela de perfis (se existir coluna role ou is_admin)
    -- Ajuste conforme sua tabela profiles. Geralmente é via user_roles.
    
    -- Inserir em user_roles se não existir
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'
    FROM auth.users
    WHERE email = 'cesar.jung@sirtec.com.br'
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Se a tabela profiles tiver coluna de role
    UPDATE public.profiles
    SET role = 'admin' -- ou o campo equivalente
    WHERE id = (SELECT id FROM auth.users WHERE email = 'cesar.jung@sirtec.com.br');

COMMIT;

-- Verifica se deu certo
SELECT * FROM public.user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'cesar.jung@sirtec.com.br');
