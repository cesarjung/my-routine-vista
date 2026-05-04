-- SCRIPT DE RECUPERAÇÃO DAS TAREFAS "ROOT" E "FILHAS" DE HOJE (04/03/2026)
-- Versão 2: Contorna a ausência da tabela 'routine_assignees' usando diretamente os checkins e criadores.

DO $$
DECLARE
    r RECORD;
    p_task_id UUID;
    chk RECORD;
    c_task_id UUID;
    t_start TIMESTAMP WITH TIME ZONE := '2026-03-04 00:00:00-03';
    t_end TIMESTAMP WITH TIME ZONE := '2026-03-04 23:59:59-03';
    has_parent BOOLEAN;
BEGIN
    -- 1. Itera sobre TODAS as rotinas ativas
    FOR r IN SELECT * FROM public.routines WHERE is_active = true LOOP
        
        -- Verifica se a rotina já tem uma tarefa raiz para não duplicar
        SELECT EXISTS(
            SELECT 1 FROM public.tasks 
            WHERE routine_id = r.id 
              AND parent_task_id IS NULL 
              AND is_recurring = true
        ) INTO has_parent;

        IF NOT has_parent THEN
            -- Cria a Tarefa Raiz
            INSERT INTO public.tasks (
                title, description, routine_id, sector_id, created_by,
                start_date, due_date, status, priority, parent_task_id,
                is_recurring, recurrence_frequency, recurrence_mode, unit_id, assigned_to
            ) VALUES (
                '[Rotina] ' || r.title,
                COALESCE(r.description, 'Rotina ' || r.frequency || ': ' || r.title),
                r.id, r.sector_id, r.created_by,
                t_start, t_end, 'pendente', 2, NULL,
                true, r.frequency, COALESCE(r.recurrence_mode, 'schedule'), NULL, r.created_by
            ) RETURNING id INTO p_task_id;

            -- Coloca o criador da Rotina como o responsável de fallback da Tarefa Raiz
            INSERT INTO public.task_assignees (task_id, user_id) VALUES (p_task_id, r.created_by);

            -- 2. Restaura as Tarefas Filhas de Hoje (baseando-se nos checkins do período atual)
            FOR chk IN 
                SELECT rc.unit_id, rc.assignee_user_id 
                FROM public.routine_periods rp
                JOIN public.routine_checkins rc ON rc.routine_period_id = rp.id
                WHERE rp.routine_id = r.id 
                  AND rp.is_active = true
                  AND rp.period_start <= t_end 
                  AND rp.period_end >= t_start
            LOOP
                -- Evita duplicar se já existir uma tarefa filha pra essa unidade hoje
                IF NOT EXISTS (
                    SELECT 1 FROM public.tasks 
                    WHERE routine_id = r.id 
                      AND parent_task_id = p_task_id 
                      AND unit_id = chk.unit_id
                      AND due_date >= t_start AND due_date <= t_end
                ) THEN
                    -- Cria Tarefa Filha
                    INSERT INTO public.tasks (
                        title, description, routine_id, sector_id, created_by,
                        start_date, due_date, status, priority, parent_task_id,
                        is_recurring, unit_id, assigned_to
                    ) VALUES (
                         '[Rotina] ' || r.title,
                        COALESCE(r.description, 'Rotina ' || r.frequency || ': ' || r.title),
                        r.id, r.sector_id, r.created_by,
                        t_start, t_end, 'pendente', 2, p_task_id,
                        false, chk.unit_id, COALESCE(chk.assignee_user_id, r.created_by)
                    ) RETURNING id INTO c_task_id;

                    -- Insere os Assignees da Filha
                    INSERT INTO public.task_assignees (task_id, user_id) 
                    VALUES (c_task_id, COALESCE(chk.assignee_user_id, r.created_by));
                END IF;
            END LOOP;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;
