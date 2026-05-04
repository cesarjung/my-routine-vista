-- CRIAR PRIMEIRO ADMIN (CORRIGIDO) 🚀
-- Recriando o Cesar Jung para você poder logar.

SELECT public.create_user_admin(
    'cesar.jung@sirtec.com.br', -- Email CORRETO
    '123456',                   -- Senha
    'Cesar Jung',               -- Nome
    'admin',                    -- Cargo
    NULL
);

-- Próximos Passos:
-- 1. Logue no App.
-- 2. Recrie a equipe.
-- 3. Rode RESTAURAR_DADOS_SAFE.sql
