-- FORÇAR ADMIN PROFILE 👑🔨
-- O script anterior pode ter rodado antes do trigger criar o perfil. 
-- Agora que o perfil existe (confirmado na imagem), vamos atualizar na marra.

BEGIN;

    -- 1. Atualiza na tabela PROFILES (usada pelo App)
    UPDATE public.profiles 
    SET role = 'admin'
    WHERE email = 'cesar.jung@sirtec.com.br';

    -- 2. Garante na tabela USER_ROLES (se existir e for usada)
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'
    FROM auth.users
    WHERE email = 'cesar.jung@sirtec.com.br'
    ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;

-- Verifica o resultado
SELECT id, email, role FROM public.profiles WHERE email = 'cesar.jung@sirtec.com.br';
