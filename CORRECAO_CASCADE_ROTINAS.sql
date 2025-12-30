-- CORREÇÃO DEFINITIVA: CASCADE DELETE NAS ROTINAS 🔄🔥
-- Isso garante que, ao apagar uma Rotina, todas as Tarefas dela sumam sozinhas.
-- Chega de lixo banco de dados.

BEGIN;

    -- 1. Remove a constraint antiga (provavelmente ON DELETE NO ACTION ou SET NULL)
    ALTER TABLE public.tasks 
    DROP CONSTRAINT IF EXISTS tasks_routine_id_fkey;

    -- 2. Adiciona a NOVA constraint com CASCADE
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_routine_id_fkey
    FOREIGN KEY (routine_id) REFERENCES public.routines(id)
    ON DELETE CASCADE;

COMMIT;

-- Opcional: Só pra confirmar que a tabela existe
SELECT count(*) as total_tasks FROM public.tasks;
