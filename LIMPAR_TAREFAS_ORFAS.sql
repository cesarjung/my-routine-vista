-- LIMPEZA DE TAREFAS ÓRFÃS (FANTASMAS DAS ROTINAS APAGADAS) 👻🧹
-- O usuário deletou as rotinas, mas as tarefas geradas por elas ficaram no limbo.
-- Vamos deletar qualquer tarefa que aponte para uma rotina que não existe mais.

BEGIN;

    DELETE FROM public.tasks 
    WHERE routine_id IS NOT NULL 
    AND routine_id NOT IN (SELECT id FROM public.routines);

COMMIT;

-- Verificando se limpou
SELECT count(*) as tarefas_orfas_restantes FROM public.tasks 
WHERE routine_id IS NOT NULL 
AND routine_id NOT IN (SELECT id FROM public.routines);
