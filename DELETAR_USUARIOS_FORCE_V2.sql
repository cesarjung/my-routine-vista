-- FORCE DELETE V2 (AGORA VAI) 🧨
-- Temos que limpar os dados dependentes (FK) antes de deletar o usuário.
-- COMO JA FIZEMOS BACKUP, PODEMOS APAGAR SEM MEDO.

BEGIN;

    --------------------------------------------------------------------------------
    -- 1. DELETAR TAREFAS (Depende de assigned_to)
    --------------------------------------------------------------------------------
    DELETE FROM public.tasks 
    WHERE assigned_to IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 2. DELETAR CHECKINS (Depende de completed_by ou user_id)
    --------------------------------------------------------------------------------
    -- O erro mencionou "routine_checkins_completed_by_fkey", então a coluna deve ser "completed_by".
    DELETE FROM public.routine_checkins 
    WHERE completed_by IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 3. DELETAR UNIT MANAGERS
    --------------------------------------------------------------------------------
    DELETE FROM public.unit_managers 
    WHERE user_id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 4. DELETAR PERFIS
    --------------------------------------------------------------------------------
    DELETE FROM public.profiles 
    WHERE id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );
    
    --------------------------------------------------------------------------------
    -- 5. O GRANDE FINAL: DELETAR USUÁRIOS DO AUTH
    --------------------------------------------------------------------------------
    DELETE FROM auth.users 
    WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br');

COMMIT;

-- Verificando quem sobrou (deve ser só o Cesar e Teste.2)
SELECT email, id FROM auth.users;
