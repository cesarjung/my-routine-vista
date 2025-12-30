-- CORREÇÃO DO ERRO NO LOG (NULL SCAN ERROR)
-- O log mostrou: "converting NULL to string is unsupported" para "confirmation_token".
-- Isso é um bug de versão, mas podemos contornar definindo os tokens como string vazia em vez de NULL.

-- 1. Ver como está o Cesar (só por curiosidade, mas não precisamos esperar)
SELECT email, confirmation_token FROM auth.users WHERE email = 'cesar.jung@sirtec.com.br';

-- 2. CORRIGIR: Transformar NULL em Vazio para todos os tokens
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

UPDATE auth.users
SET recovery_token = ''
WHERE recovery_token IS NULL;

UPDATE auth.users
SET email_change_token_new = ''
WHERE email_change_token_new IS NULL;

UPDATE auth.users
SET email_change_token_current = ''
WHERE email_change_token_current IS NULL;

SELECT 'Tokens corrigidos (NULL -> Vazio). Tente logar agora.' as status;
