-- CORREÇÃO NUCLEAR DE PERMISSÕES (TENTATIVA FINAL)
-- Se isso não funcionar, o banco está com algum bloqueio profundo.

-- 1. Garantir que o schema public pertence ao postgres (dono do banco)
ALTER SCHEMA public OWNER TO postgres;

-- 2. Garantir que as extensões pertencem ao postgres
ALTER SCHEMA extensions OWNER TO postgres;

-- 3. Resetar permissões do public
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public; -- (Isso é o padrão do Postgre, permite acesso geral)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;

-- 4. Resetar permissões da extensions
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_auth_admin;

-- 5. Tenta criar um usuário de teste DIRETAMENTE NO SQL para ver se o banco aceita
-- (Se isso funcionar, o banco consegue escrever na auth.users)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'teste.login@sirtec.com.br') THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'teste.login@sirtec.com.br',
            crypt('123456', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            '',
            ''
        );
        RAISE NOTICE 'Usuário de teste criado: teste.login@sirtec.com.br / 123456';
    END IF;
END $$;

NOTIFY pgrst, 'reload config';

SELECT 'Permissões resetadas e usuário de teste criado.' as status;
