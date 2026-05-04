CREATE OR REPLACE FUNCTION public.debug_recurring_tasks()
RETURNS TABLE(log_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    task_record RECORD;
    calc_next_start timestamp with time zone;
    is_valid_creation boolean;
    already_exists boolean;
BEGIN
    RETURN QUERY SELECT '---- INICIANDO DEBUG DO MODO SCHEDULE ----'::TEXT;

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
        RETURN QUERY SELECT '========================================='::TEXT;
        RETURN QUERY SELECT 'Lendo Tarefa ROOT ID: ' || task_record.id || ' | Título: ' || task_record.title;
        RETURN QUERY SELECT 'Start (Original UTC): ' || task_record.start_date;
        RETURN QUERY SELECT 'Start (America/Sao_Paulo): ' || (task_record.start_date AT TIME ZONE 'America/Sao_Paulo');
        
        IF task_record.recurrence_frequency = 'diaria' THEN
            calc_next_start := task_record.start_date + INTERVAL '1 day';
        ELSIF task_record.recurrence_frequency = 'semanal' THEN
            calc_next_start := task_record.start_date + INTERVAL '1 week';
        ELSIF task_record.recurrence_frequency = 'quinzenal' THEN
            calc_next_start := task_record.start_date + INTERVAL '2 weeks';
        ELSIF task_record.recurrence_frequency = 'mensal' THEN
            calc_next_start := task_record.start_date + INTERVAL '1 month';
        ELSE
            calc_next_start := task_record.start_date + INTERVAL '1 day';
        END IF;

        RETURN QUERY SELECT 'Próxima Data (Original UTC): ' || calc_next_start;
        RETURN QUERY SELECT 'Próxima Data (America/Sao_Paulo): ' || (calc_next_start AT TIME ZONE 'America/Sao_Paulo');

        -- A verificação
        is_valid_creation := ((calc_next_start AT TIME ZONE 'America/Sao_Paulo')::date <= ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1)) OR (task_record.status = 'concluida');
        RETURN QUERY SELECT 'Matemática da Janela - Now (BR): ' || (now() AT TIME ZONE 'America/Sao_Paulo')::date;
        RETURN QUERY SELECT 'Matemática da Janela - NextStart (BR): ' || (calc_next_start AT TIME ZONE 'America/Sao_Paulo')::date;
        RETURN QUERY SELECT 'Is Valid Creation? (Ta na janela?): ' || is_valid_creation::TEXT;

        IF is_valid_creation THEN
            -- NOT EXISTS check
            SELECT EXISTS (
                SELECT 1 FROM public.tasks 
                WHERE routine_id = task_record.routine_id
                  AND parent_task_id IS NULL
                  AND (start_date AT TIME ZONE 'America/Sao_Paulo')::date = (calc_next_start AT TIME ZONE 'America/Sao_Paulo')::date
            ) INTO already_exists;

            RETURN QUERY SELECT 'Already Exists (Previamente criada)? ' || already_exists::TEXT;
            
            IF NOT already_exists THEN
                RETURN QUERY SELECT '>>> O INSERIR DEVERIA ACONTECER AQUI <<<';
            ELSE
                RETURN QUERY SELECT '>>> INSERIDO ABORTADO POIS EXISTE <<<';
            END IF;
        END IF;

    END LOOP;

    RETURN QUERY SELECT '---- FIM ----'::TEXT;
END;
$$;
