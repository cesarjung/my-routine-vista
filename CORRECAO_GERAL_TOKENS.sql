-- CORREÇÃO GERAL DE TOKENS (SCAN ERROR)
-- O campo confirmation_token já foi limpo, mas pode ser que o erro agora seja em OUTRO campo.

UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE email IN ('teste.2@sirtec.com.br', 'felipe.moura@sirtec.com.br');

SELECT 'Todos os tokens nulos foram convertidos para vazio.' as status;
