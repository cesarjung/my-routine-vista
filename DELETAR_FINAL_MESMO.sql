-- DELETAR FINAL (O EXTERMINADOR DE ZUMBIS) 🤖🔫
-- Baseado no diagnóstico profundo. Limpa TUDO que prende o usuário.

BEGIN;

    -- SEGURO DE VIDA: Definimos aqui o Admin que vai "herdar" as criações orfãs (Rotinas, Seções)
    -- Para não apagar as Rotinas do sistema.
    -- (Se não achar o Cesar, tenta o teste.2. Se não, usa NULL, mas pode falhar se for NOT NULL)
    
    -- 1. DESVINCULAR CRIADORES (Herança para o Cesar ou NULL)
    -- Routines
    UPDATE public.routines 
    SET created_by = (SELECT id FROM auth.users WHERE email = 'cesar.junior@sirtec.com.br' LIMIT 1)
    WHERE created_by IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Sector Sections
    UPDATE public.sector_sections 
    SET created_by = (SELECT id FROM auth.users WHERE email = 'cesar.junior@sirtec.com.br' LIMIT 1) 
    WHERE created_by IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Tasks (created_by)
    UPDATE public.tasks 
    SET created_by = NULL -- Tasks criadas geralmente podem ficar null
    WHERE created_by IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));
    
    -- Dashboard Layout (updated_by)
    UPDATE public.dashboard_layout
    SET updated_by = NULL
    WHERE updated_by IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));


    -- 2. DELETAR DEPENDÊNCIAS (Dados que pertencem ao usuário e devem sumir)
    
    -- Google Calendar
    DELETE FROM public.google_calendar_tokens
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Dashboard
    DELETE FROM public.dashboard_panels
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    DELETE FROM public.dashboard_layout
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Checkins (Ambos os campos responsáveis)
    DELETE FROM public.routine_checkins 
    WHERE completed_by IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'))
       OR assignee_user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Tasks (Assigned) - Já fizemos backup
    DELETE FROM public.tasks 
    WHERE assigned_to IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Unit Managers
    DELETE FROM public.unit_managers 
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- User Roles (Tabela antiga)
    DELETE FROM public.user_roles 
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));

    -- Profiles (Se ainda existir)
    DELETE FROM public.profiles 
    WHERE id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));
    
    -- OAuth / Tokens (Tabelas do Auth Schema - Cuidado)
    -- Geralmente Cascade cuida, mas se não...
    DELETE FROM auth.identities
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));
    
    DELETE FROM auth.sessions
    WHERE user_id IN (SELECT id FROM auth.users WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br'));


    -- 3. O GRANDE FINAL: AUTH USERS
    DELETE FROM auth.users 
    WHERE email NOT IN ('cesar.junior@sirtec.com.br', 'teste.2@sirtec.com.br');

COMMIT;

SELECT count(*) as zumbis_restantes FROM auth.users;
