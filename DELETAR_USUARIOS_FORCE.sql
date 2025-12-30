-- FORCE DELETE (MODO HARDCORE) 🧨
-- O painel trava porque o usuário está podre. Vamos arrancar pela raiz via SQL.

BEGIN;

    -- 1. Defina aqui quem NÃO DEVE ser deletado (Cesar e Teste.2)
    -- Ajuste o email do Cesar se estiver diferente!
    
    -- Deletar Managers
    DELETE FROM public.unit_managers 
    WHERE user_id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    -- Deletar Perfis
    DELETE FROM public.profiles 
    WHERE id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );
    
    -- Deletar Usuários do Auth (A Raiz do Problema)
    DELETE FROM auth.users 
    WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br');

COMMIT;

-- Mostra quem sobreviveu
SELECT email, id FROM auth.users;
