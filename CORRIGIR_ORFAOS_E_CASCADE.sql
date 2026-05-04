-- CORREÇÃO DE TAREFAS ÓRFÃS E PREVENÇÃO FUTURA
-- 1. Remove tarefas que apontam para rotinas inexistentes
-- 2. Tenta alterar a constraint para ON DELETE CASCADE (se possível)

BEGIN;

-- 1. Limpeza (Deletar Zombies)
DELETE FROM public.tasks 
WHERE routine_id IS NOT NULL 
AND routine_id NOT IN (SELECT id FROM public.routines);

-- 2. Alteração da Constraint para evitar recorrência
-- Primeiro removemos a constraint antiga
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_routine_id_fkey;

-- Recriamos com CASCADE
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_routine_id_fkey 
FOREIGN KEY (routine_id) 
REFERENCES public.routines(id) 
ON DELETE CASCADE;

COMMIT;

-- Verificação final
SELECT count(*) as orfaos_restantes FROM public.tasks 
WHERE routine_id IS NOT NULL 
AND routine_id NOT IN (SELECT id FROM public.routines);
