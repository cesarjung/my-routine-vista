-- SALVANDO TODOS OS USUÁRIOS (O FIX DA VIRADA) 🚀
-- Descobrimos que o campo 'raw_app_meta_data' está NULO nos usuários quebrados.
-- O sistema precisa saber qual é o "provider" (email), senão ele trava.

UPDATE auth.users
SET raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE raw_app_meta_data IS NULL;

-- Reforço: Garantir que os tokens não voltem a ser nulos
UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL;

SELECT email, raw_app_meta_data FROM auth.users ORDER BY email;
