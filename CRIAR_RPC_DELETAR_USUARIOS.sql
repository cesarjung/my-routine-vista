-- FUNÇÃO RPC PARA DELETAR USUÁRIO
-- Cria uma função segura no banco que permite admins e gestores deletarem usuários e suas dependências.
-- Substitui a necessidade de Edge Functions complexas.

CREATE OR REPLACE FUNCTION public.delete_user_rpc(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    is_allowed boolean;
BEGIN
    -- Verifica se o usuário que está chamando a função é admin ou gestor
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'gestor')
    ) INTO is_allowed;

    IF NOT is_allowed THEN
        RAISE EXCEPTION 'Apenas administradores e gestores podem deletar usuários.';
    END IF;

    -- Prevenir deletar a si mesmo
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode deletar a si mesmo.';
    END IF;

    -- 1. DESVINCULAR OU DELETAR DEPENDÊNCIAS
    
    -- Desvincular criador em routines
    UPDATE public.routines 
    SET created_by = NULL
    WHERE created_by = target_user_id;

    -- Desvincular criador em sector_sections
    UPDATE public.sector_sections 
    SET created_by = NULL
    WHERE created_by = target_user_id;

    -- Desvincular criador / atribuído em tasks
    UPDATE public.tasks 
    SET created_by = NULL
    WHERE created_by = target_user_id;

    UPDATE public.tasks 
    SET assigned_to = NULL
    WHERE assigned_to = target_user_id;

    -- Google Calendar tokens
    DELETE FROM public.google_calendar_tokens
    WHERE user_id = target_user_id;

    -- Dashboard panels e layout
    DELETE FROM public.dashboard_panels
    WHERE user_id = target_user_id;

    DELETE FROM public.dashboard_layout
    WHERE user_id = target_user_id;

    -- Checkins (limpar atribuições ou deletar)
    UPDATE public.routine_checkins 
    SET completed_by = NULL
    WHERE completed_by = target_user_id;

    UPDATE public.routine_checkins 
    SET assignee_user_id = NULL
    WHERE assignee_user_id = target_user_id;

    -- Atribuições conjuntas em task_assignees
    DELETE FROM public.task_assignees 
    WHERE user_id = target_user_id;

    -- Unit managers
    DELETE FROM public.unit_managers 
    WHERE user_id = target_user_id;

    -- User roles (tabela antiga se houver)
    DELETE FROM public.user_roles 
    WHERE user_id = target_user_id;

    -- Perfis da tabela public.profiles
    DELETE FROM public.profiles 
    WHERE id = target_user_id;

    -- Identidades e sessões na auth
    DELETE FROM auth.identities
    WHERE user_id = target_user_id;
    
    DELETE FROM auth.sessions
    WHERE user_id = target_user_id;

    -- 2. Deletar da tabela auth.users
    DELETE FROM auth.users 
    WHERE id = target_user_id;

END;
$$;
