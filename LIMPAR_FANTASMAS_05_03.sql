-- LIMPAR FANTASMAS DO DIA 05/03 DA ROTINA "Check de Disponibilidade"
-- Este script limpa os registros corrompidos gerados pelo bug do timestamp antes da nossa correção.

DO $$
DECLARE
    v_routine_id UUID;
    v_parent_task_id UUID;
BEGIN
    -- 1. Encontrar o ID da rotina "Check de Disponibilidade"
    SELECT id INTO v_routine_id
    FROM routines
    WHERE title = 'Check de Disponibilidade'
    LIMIT 1;

    IF v_routine_id IS NULL THEN
        RAISE EXCEPTION 'Rotina Check de Disponibilidade não encontrada.';
    END IF;

    -- 2. Encontrar e APAGAR períodos corrompidos que foram gerados para o dia 05/03
    -- (No horário UTC, eles aparecem como 2026-03-05T03:00:00Z ou superior)
    DELETE FROM routine_periods
    WHERE routine_id = v_routine_id
    AND period_start >= '2026-03-05 00:00:00+00';

    -- 3. Encontrar a tarefa pai fantasma do dia 05/03 (se existir)
    SELECT id INTO v_parent_task_id
    FROM tasks
    WHERE routine_id = v_routine_id
    AND parent_task_id IS NULL
    AND due_date >= '2026-03-05 00:00:00+00'
    LIMIT 1;

    IF v_parent_task_id IS NOT NULL THEN
        -- 4. Excluir todas as tarefas filhas associadas a essa tarefa pai fantasma
        DELETE FROM tasks
        WHERE parent_task_id = v_parent_task_id;

        -- 5. Excluir a tarefa pai fantasma
        DELETE FROM tasks
        WHERE id = v_parent_task_id;
    END IF;

END $$;
