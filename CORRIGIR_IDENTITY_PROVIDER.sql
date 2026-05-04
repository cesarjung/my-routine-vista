-- CORREÇÃO DE IDENTIDADE (PROVIDER ID) 🆔🔧
-- O Supabase pode estar esperando que o provider_id seja o ID do usuário (UUID), e não o email.

BEGIN;

    UPDATE auth.identities
    SET provider_id = user_id::text
    WHERE provider = 'email' 
    AND provider_id != user_id::text;

COMMIT;

-- Verifica como ficou
SELECT provider_id, user_id, email FROM auth.identities WHERE email = 'cesar.jung@sirtec.com.br';
