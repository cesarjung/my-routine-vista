-- CRIAÇÃO DE LOGINS PARA PERFIS EXISTENTES
-- Este script percorre todos os perfis na tabela 'profiles' que não possuem um login no sistema
-- e cria automaticamente o usuário na tabela de autenticação.
-- SENHA PADRÃO: 123456

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    profile_record RECORD;
    count_created INTEGER := 0;
BEGIN
    -- Loop por todos os perfis que não têm usuário correspondente na tabela auth.users (pelo ID)
    FOR profile_record IN 
        SELECT p.* 
        FROM public.profiles p
        WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    LOOP
        -- Tenta inserir o usuário na tabela auth.users mantendo o MESMO ID do perfil
        BEGIN
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
                is_sso_user
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                profile_record.id,
                'authenticated',
                'authenticated',
                profile_record.email,
                crypt('123456', gen_salt('bf')), -- Senha padrão: 123456
                NOW(),
                '{"provider": "email", "providers": ["email"]}',
                jsonb_build_object('name', profile_record.full_name, 'full_name', profile_record.full_name),
                NOW(),
                NOW(),
                FALSE
            );
            
            count_created := count_created + 1;
            RAISE NOTICE 'Usuário criado para: % (ID: %)', profile_record.email, profile_record.id;
            
        EXCEPTION 
            WHEN unique_violation THEN
                -- Se der erro de e-mail duplicado (já existe auth com esse email mas outro ID), avisamos
                RAISE NOTICE 'AVISO: O email % já existe no Auth com outro ID. O perfil não foi sincronizado.', profile_record.email;
            WHEN OTHERS THEN
                RAISE NOTICE 'ERRO ao criar usuário %: %', profile_record.email, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Total de usuários criados: %', count_created;
END $$;
