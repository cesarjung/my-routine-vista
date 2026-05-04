-- RESET DE SENHA ESPECÍFICO PARA O CESAR
-- Reseta a senha do usuário cesar.jung@sirtec.com.br para '123456'

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'cesar.jung@sirtec.com.br';
