-- FORCE DELETE V3 (AGORA VAI MESMO!) 🧨
-- Adicionamos dashboard_panels à lista de limpeza.

BEGIN;

    --------------------------------------------------------------------------------
    -- 0. DASHBOARD PANELS (Novo vilão encontrado)
    --------------------------------------------------------------------------------
    DELETE FROM public.dashboard_panels
    WHERE user_id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 1. TAREFAS
    --------------------------------------------------------------------------------
    DELETE FROM public.tasks 
    WHERE assigned_to IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 2. CHECKINS
    --------------------------------------------------------------------------------
    DELETE FROM public.routine_checkins 
    WHERE completed_by IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 3. UNIT MANAGERS
    --------------------------------------------------------------------------------
    DELETE FROM public.unit_managers 
    WHERE user_id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );

    --------------------------------------------------------------------------------
    -- 4. PERFIS
    --------------------------------------------------------------------------------
    DELETE FROM public.profiles 
    WHERE id IN (
        SELECT id FROM auth.users 
        WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br')
    );
    
    --------------------------------------------------------------------------------
    -- 5. AUTH USERS
    --------------------------------------------------------------------------------
    DELETE FROM auth.users 
    WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br');

COMMIT;

-- Verificando
SELECT email, id FROM auth.users;
