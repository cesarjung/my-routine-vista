-- LIMPEZA DOS PERÍODOS QUEBRADOS DE HOJE (05/03)
-- Este script apaga as tentativas falhas de criação de hoje para que você possa clicar em "Iniciar Período" novamente
-- e gerar as tarefas perfeitas usando o esqueleto que acabamos de reconstruir.
-- NOTA: Ele IGNORA a rotina "Informe de Energizações" pois você avisou que ela está normal!

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT id, title 
        FROM public.routines 
        WHERE title IN ('Check de Disponibilidade', 'Checkpoint Diário', 'Boletim de Produtividade')
    LOOP
        -- 1. Apagar Períodos de 05/03 dessas rotinas
        DELETE FROM public.routine_periods 
        WHERE routine_id = rec.id 
        AND period_start >= '2026-03-05 00:00:00+00';

        -- 2. Encontrar a Tarefa Pai de 05/03
        DECLARE
            v_parent_id UUID;
        BEGIN
            SELECT id INTO v_parent_id 
            FROM public.tasks 
            WHERE routine_id = rec.id 
            AND parent_task_id IS NULL 
            AND due_date >= '2026-03-05 00:00:00+00'
            LIMIT 1;

            IF v_parent_id IS NOT NULL THEN
                -- Apagar tarefas filhas de 05/03
                DELETE FROM public.tasks WHERE parent_task_id = v_parent_id;
                -- Apagar tarefa pai de 05/03
                DELETE FROM public.tasks WHERE id = v_parent_id;
            END IF;
        END;
    END LOOP;
END $$;
