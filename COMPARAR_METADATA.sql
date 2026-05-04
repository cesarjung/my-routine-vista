-- COMPARAR METADADOS (O SEGREDO ESTÁ NO JSON?)
-- Nós bloqueamos nas permissões de estrutura, mas podemos mexer nos dados.
-- O usuário Cesar funciona. O Felipe não. Vamos ver o JSON completo deles.

SELECT 
    email, 
    raw_user_meta_data 
FROM auth.users 
WHERE email IN ('cesar.jung@sirtec.com.br', 'felipe.moura@sirtec.com.br');
