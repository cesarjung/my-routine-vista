-- VERIFICAÇÃO GERAL DOS USUÁRIOS
-- Vamos ver quais ainda estão com o defeito do TOKEN NULL

SELECT 
    email, 
    last_sign_in_at,
    -- Se der TRUE/algo aqui, é perigoso
    (confirmation_token IS NULL) as conf_null,
    (recovery_token IS NULL) as rec_null,
    (email_change_token_new IS NULL) as email_null
FROM auth.users
ORDER BY email;
