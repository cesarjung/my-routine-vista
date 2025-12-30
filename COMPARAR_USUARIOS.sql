-- COMPARATIVO DE USUÁRIOS (O JOGO DOS 7 ERROS)
-- Vamos ver o que o usuário que "funciona" tem de diferente dos outros.

SELECT 
    email, 
    role,               -- Deve ser 'authenticated'
    aud,                -- Deve ser 'authenticated'
    email_confirmed_at, -- Não pode ser NULL
    left(encrypted_password, 4) as pass_start, -- Vê se começa com $2a$ (bcrypt) ou outro
    last_sign_in_at,    -- Quem logou recentemente é o que funciona
    raw_user_meta_data  -- Ver se tem metadados extras
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST
LIMIT 10;
