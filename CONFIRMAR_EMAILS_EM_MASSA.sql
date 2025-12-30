-- CONFIRMAR EMAILS EM MASSA
-- Isso libera o login para usuários que o sistema considera como "não verificados"

UPDATE auth.users
SET email_confirmed_at = timezone('utc', now())
WHERE email_confirmed_at IS NULL;

-- Recarregar cache
NOTIFY pgrst, 'reload config';
