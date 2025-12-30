-- LENDO O CÓDIGO FONTE DA FUNÇÃO DEFEITUOSA
-- Preciso ver como ela está escrita hoje para corrigir.

SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'create_user_admin';
