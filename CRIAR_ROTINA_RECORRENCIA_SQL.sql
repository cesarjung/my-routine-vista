-- ==============================================================================
-- 1. HABILITAR EXTENSÃO PG_CRON (se já não estiver)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ==============================================================================
-- 2. FUNÇÃO PRINCIPAL: PROCESSAR RECORRÊNCIAS (PROCESS_RECURRING_TASKS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_recurring_tasks()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    task_record RECORD;
    new_task_id uuid;
    child_task RECORD;
    new_child_task_id uuid;
    calc_next_start timestamp with time zone;
    calc_next_due timestamp with time zone;
    task_duration interval;
    anchor_start timestamp with time zone;
    is_valid_creation boolean;
BEGIN
    -- =============================================
    -- A. PROCESSAR MODO: SCHEDULE (Agendadas)
    -- =============================================
    FOR task_record IN 
        SELECT t.*, pt.start_date as parent_start_date 
        FROM public.tasks t
        LEFT JOIN public.tasks pt ON pt.id = t.parent_task_id
        WHERE t.is_recurring = true 
          AND t.recurrence_mode = 'schedule'
          AND t.status IN ('pendente', 'em_andamento', 'concluida')
          AND t.start_date IS NOT NULL 
          AND t.due_date IS NOT NULL
          AND t.parent_task_id IS NULL
    LOOP
        -- Duração da tarefa base
        task_duration := task_record.due_date - task_record.start_date;
        anchor_start := COALESCE(task_record.parent_start_date, task_record.start_date);

        -- Calcular próxima data de Início com base na frequência
        -- Para evitar erros de conversão do banco UTC do Supabase, 
        -- todas as somas de INTERVAL garantem o cálculo sobre o fuso brasileiro antes de voltar para timestamptz.
        IF task_record.recurrence_frequency = 'diaria' THEN
            calc_next_start := ((task_record.start_date AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo';
        ELSIF task_record.recurrence_frequency = 'semanal' THEN
            calc_next_start := ((task_record.start_date AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 week') AT TIME ZONE 'America/Sao_Paulo';
        ELSIF task_record.recurrence_frequency = 'quinzenal' THEN
            calc_next_start := ((task_record.start_date AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 weeks') AT TIME ZONE 'America/Sao_Paulo';
        ELSIF task_record.recurrence_frequency = 'mensal' THEN
            calc_next_start := ((task_record.start_date AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month') AT TIME ZONE 'America/Sao_Paulo';
        ELSE
            calc_next_start := ((task_record.start_date AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo';
        END IF;

        -- Calcula o due_date preservando as exatas horas em relação ao start
        calc_next_due := calc_next_start + task_duration;

        -- Regra "Schedule": criar se a PRÓXIMA data for igual ou anterior a AMANHÃ (fuso Brasil).
        is_valid_creation := ((calc_next_start AT TIME ZONE 'America/Sao_Paulo')::date <= ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1)) OR (task_record.status = 'concluida');

        IF is_valid_creation THEN
            -- Verifica se já não foi criada para esta data (evitar duplicar caso script rode 2x)
            IF NOT EXISTS (
                SELECT 1 FROM public.tasks 
                WHERE routine_id = task_record.routine_id
                  AND parent_task_id IS NULL
                  AND (start_date AT TIME ZONE 'America/Sao_Paulo')::date = (calc_next_start AT TIME ZONE 'America/Sao_Paulo')::date
            ) THEN
                -- INSERIR NOVA TAREFA (ROOT)
                INSERT INTO public.tasks (
                    title, description, unit_id, sector_id, assigned_to, created_by,
                    start_date, due_date, priority, status, is_recurring, 
                    recurrence_frequency, recurrence_mode, parent_task_id, routine_id
                ) VALUES (
                    task_record.title, task_record.description, task_record.unit_id, task_record.sector_id, task_record.assigned_to, task_record.created_by,
                    calc_next_start, calc_next_due, COALESCE(task_record.priority, 1), 'pendente', true,
                    task_record.recurrence_frequency, task_record.recurrence_mode, NULL, task_record.routine_id
                ) RETURNING id INTO new_task_id;

                -- Copiar Assignees da Root
                INSERT INTO public.task_assignees (task_id, user_id)
                SELECT new_task_id, user_id FROM public.task_assignees WHERE task_id = task_record.id;

                -- Copiar Subtasks
                INSERT INTO public.subtasks (task_id, title, order_index, is_completed)
                SELECT new_task_id, title, order_index, false FROM public.subtasks WHERE task_id = task_record.id;

                -- RECURSÃO: TAREFAS FILHAS (As Unidades dentro de uma Rotina Principal)
                FOR child_task IN SELECT * FROM public.tasks WHERE parent_task_id = task_record.id LOOP
                     INSERT INTO public.tasks (
                        title, description, unit_id, sector_id, assigned_to, created_by,
                        start_date, due_date, priority, status, is_recurring, 
                        parent_task_id, routine_id
                    ) VALUES (
                        child_task.title, child_task.description, child_task.unit_id, child_task.sector_id, child_task.assigned_to, task_record.created_by,
                        calc_next_start, calc_next_due, COALESCE(child_task.priority, 1), 'pendente', false,
                        new_task_id, task_record.routine_id
                    ) RETURNING id INTO new_child_task_id;

                    -- Copiar Assignees das Filhas
                    INSERT INTO public.task_assignees (task_id, user_id)
                    SELECT new_child_task_id, user_id FROM public.task_assignees WHERE task_id = child_task.id;
                END LOOP;
            END IF;
        END IF;

    END LOOP;

    -- =============================================
    -- B. PROCESSAR MODO: ON_COMPLETION (Triggers quando concluida)
    -- =============================================
    FOR task_record IN 
        SELECT * FROM public.tasks
        WHERE is_recurring = true 
          AND recurrence_mode = 'on_completion'
          AND status = 'concluida'
          AND start_date IS NOT NULL 
          AND due_date IS NOT NULL
          AND parent_task_id IS NULL
    LOOP
        task_duration := task_record.due_date - task_record.start_date;

        -- On Completion: baseia-se na data ATUAL (hoje), não na planejada.
        -- Como CURRENT_DATE pode usar UTC, forçamos o cálculo em America/Sao_Paulo
        DECLARE
            local_now timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
            local_start timestamp := task_record.start_date AT TIME ZONE 'America/Sao_Paulo';
        BEGIN
            IF task_record.recurrence_frequency = 'diaria' THEN
                calc_next_start := ((local_now::date + INTERVAL '1 day') + local_start::time) AT TIME ZONE 'America/Sao_Paulo';
            ELSIF task_record.recurrence_frequency = 'semanal' THEN
                calc_next_start := ((local_now::date + INTERVAL '1 week') + local_start::time) AT TIME ZONE 'America/Sao_Paulo';
            ELSIF task_record.recurrence_frequency = 'quinzenal' THEN
                calc_next_start := ((local_now::date + INTERVAL '2 weeks') + local_start::time) AT TIME ZONE 'America/Sao_Paulo';
            ELSIF task_record.recurrence_frequency = 'mensal' THEN
                calc_next_start := ((local_now::date + INTERVAL '1 month') + local_start::time) AT TIME ZONE 'America/Sao_Paulo';
            ELSE
                calc_next_start := ((local_now::date + INTERVAL '1 day') + local_start::time) AT TIME ZONE 'America/Sao_Paulo';
            END IF;
            
            calc_next_due := calc_next_start + task_duration;

        -- Verifica Existência
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE routine_id = task_record.routine_id
                AND parent_task_id IS NULL
                AND start_date::date = calc_next_start::date
        ) THEN
            -- Inserir Nova
            INSERT INTO public.tasks (
                title, description, unit_id, sector_id, assigned_to, created_by,
                start_date, due_date, priority, status, is_recurring, 
                recurrence_frequency, recurrence_mode, parent_task_id, routine_id
            ) VALUES (
                task_record.title, task_record.description, task_record.unit_id, task_record.sector_id, task_record.assigned_to, task_record.created_by,
                calc_next_start, calc_next_due, COALESCE(task_record.priority, 1), 'pendente', true,
                task_record.recurrence_frequency, task_record.recurrence_mode, NULL, task_record.routine_id
            ) RETURNING id INTO new_task_id;

            -- Assignees & Subtasks Root
            INSERT INTO public.task_assignees (task_id, user_id)
            SELECT new_task_id, user_id FROM public.task_assignees WHERE task_id = task_record.id;

            INSERT INTO public.subtasks (task_id, title, order_index, is_completed)
            SELECT new_task_id, title, order_index, false FROM public.subtasks WHERE task_id = task_record.id;

            -- Tarefas Filhas (Unidades)
            FOR child_task IN SELECT * FROM public.tasks WHERE parent_task_id = task_record.id LOOP
                INSERT INTO public.tasks (
                    title, description, unit_id, sector_id, assigned_to, created_by,
                    start_date, due_date, priority, status, is_recurring, 
                    parent_task_id, routine_id
                ) VALUES (
                    child_task.title, child_task.description, child_task.unit_id, child_task.sector_id, child_task.assigned_to, task_record.created_by,
                    calc_next_start, calc_next_due, COALESCE(child_task.priority, 1), 'pendente', false,
                    new_task_id, task_record.routine_id
                ) RETURNING id INTO new_child_task_id;

                INSERT INTO public.task_assignees (task_id, user_id)
                SELECT new_child_task_id, user_id FROM public.task_assignees WHERE task_id = child_task.id;
            END LOOP;
        END IF;

        END;

    END LOOP;

    RETURN true;
END;
$$;

-- ==============================================================================
-- 3. AGENDAMENTO: RODAR TODA MADRUGADA (00:05)
-- ==============================================================================
-- Desativa jobs antigos com o mesmo nome para evitar duplicações
SELECT cron.unschedule('daily_recurring_tasks_job') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_recurring_tasks_job');

-- Agenda a PROCEDURE para rodar todos os dias à 0h e 5min.
SELECT cron.schedule(
    'daily_recurring_tasks_job', 
    '5 0 * * *', 
    $$SELECT public.process_recurring_tasks()$$
);
