-- VERIFICAÇÃO PÓS-CORREÇÃO
-- Vamos ver se o UPDATE realmente pegou ou se o sistema ignorou.

SELECT 
    email, 
    -- Se der TRUE aqui, o problema ainda é esse.
    (confirmation_token IS NULL) as token_eh_nulo,
    -- Se der TRUE aqui, deveria ter funcionado (ou o erro mudou).
    (confirmation_token = '') as token_eh_vazio,
    last_sign_in_at
FROM auth.users 
WHERE email = 'teste.2@sirtec.com.br';
