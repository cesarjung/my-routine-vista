-- DESTRUIR DADOS ÓRFÃOS DAS TENTATIVAS DE CRIAÇÃO DO DIA 05/03
-- Como passamos os RLS e a FK, o banco inseriu as coisas parcialmente nas tentativas anteriores 
-- (O período e alguns checkins) antes daquele erro 400 acontecer!
-- Agora ele tenta inserir o checkin de novo e capota por conta da "Unique Key" de "já existe checkin pra essa unidade".

-- Vamos varrer o LIXO do dia 05/03 pra deixar a pista polida pra tentativa Vencedora Oficial:

DO $$
BEGIN
    -- 1. Apagar TODOS OS CHECKINS vinculados a qualquer período ativo (criado hoje erroneamente)
    DELETE FROM public.routine_checkins
    WHERE routine_period_id IN (
        SELECT id FROM public.routine_periods 
        WHERE period_start >= '2026-03-05 00:00:00+00'
    );

    -- 2. Apagar TODAS AS TAREFAS criadas sob esses períodos de hoje
    DELETE FROM public.tasks
    WHERE start_date >= '2026-03-05 00:00:00+00';

    -- 3. Apagar TODOS OS PERÍODOS CRIADOS HOJE
    DELETE FROM public.routine_periods
    WHERE period_start >= '2026-03-05 00:00:00+00';

END $$;
