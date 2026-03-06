-- LIMPEZA DEFINITIVA DAS TAREFAS QUEBRADAS DO RASTREADOR (05/03 a 06/03)
-- Este script limpa exatamente os resquícios do Checkpoint Diário e do Boletim
-- que ficaram presos no Rastreador.
-- Após rodar isso, o Rastreador ficará 100% zerado e você poderá clicar em "Iniciar Período"
-- para gerar os 3 preenchidos com as Tabelas oficiais!

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT id, title 
        FROM public.routines 
        WHERE title IN ('Checkpoint Diário', 'Boletim de Produtividade', 'Check de Disponibilidade')
    LOOP
        -- 1. Apagar Períodos
        DELETE FROM public.routine_periods 
        WHERE routine_id = rec.id 
        AND period_start >= '2026-03-05 00:00:00+00';

        -- 2. Apagar TODAS as tarefas filhas e pais que nasceram com datas de 05/03 ou 06/03
        -- Relacionadas a essas 3 rotinas enguiçadas
        DELETE FROM public.tasks 
        WHERE routine_id = rec.id 
        AND start_date >= '2026-03-05 00:00:00+00';
        
    END LOOP;
END $$;
