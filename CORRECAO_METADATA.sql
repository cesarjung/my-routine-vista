-- CORREÇÃO VIA METADATA (A CURA DO "SUB")
-- O usuário Cesar (que funciona) tem o campo "sub" nos metadados. O Felipe não.
-- Vamos ensinar o sistema que o Felipe também tem um "sub".

-- 1. Atualizar o Felipe/Teste.2 inserindo o ID dele como "sub" no JSON
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{sub}',
    to_jsonb(id::text) -- Usa o próprio ID do usuário como 'sub'
  )
WHERE email IN ('teste.2@sirtec.com.br', 'felipe.moura@sirtec.com.br');

-- 2. Confirmar a mudança
SELECT email, raw_user_meta_data 
FROM auth.users 
WHERE email IN ('teste.2@sirtec.com.br', 'felipe.moura@sirtec.com.br');
