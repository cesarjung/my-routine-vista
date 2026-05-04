-- RESET DE SENHA ESPECÍFICO
-- Use APENAS se nenhum outro método funcionar e você quiser resetar a senha deste usuário para 123456

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'felipe.moura@sirtec.com.br';
