-- CORREÇÃO DO LOGIN (INSTANCE ID) 🔧
-- O erro 500 provavelmente é porque o instance_id ficou NULL.
-- Vamos preencher com o ID correto.

DO $$
DECLARE
    v_instance_id uuid;
BEGIN
    -- 1. Descobrir qual é o Instance ID deste Supabase
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    
    -- Se não retornar nada, usa o padrão mundial (Global)
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- 2. Corrigir o usuário Cesar
    UPDATE auth.users 
    SET instance_id = v_instance_id
    WHERE email = 'cesar.jung@sirtec.com.br';

    -- 3. (Opcional) Corrigir Identidades também se precisar (geralmente herda)
    -- UPDATE auth.identities SET identity_data = ... -- Não, identity_data não tem instance_id.

    RAISE NOTICE 'Usuário atualizado com Instance ID: %', v_instance_id;
END $$;

-- Verificando
SELECT email, instance_id FROM auth.users WHERE email = 'cesar.jung@sirtec.com.br';
