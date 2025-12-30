-- CHECAGEM FINAL DE TOKENS
-- Vamos ver quais colunas ainda estão NULAS e causando o erro.

SELECT 
    email, 
    (confirmation_token IS NULL) as conf_null,
    (recovery_token IS NULL) as recovery_null,
    (email_change_token_new IS NULL) as email_change_null,
    (email_change_token_current IS NULL) as email_cur_null,
    (phone_change_token IS NULL) as phone_null
FROM auth.users 
WHERE email = 'teste.2@sirtec.com.br';
