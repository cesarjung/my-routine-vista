-- ========================================================
-- CORREÇÃO DE TAREFAS ÓRFÃS E RESTRIÇÃO DE SETOR (CASCADE)
-- ========================================================

-- 1. DELETAR AS ROTINAS E TAREFAS QUE ESTÃO 'SEM SETOR' (ÓRFÃS)
-- Como o usuário diz: "sempre as tarefas precisam estar atreladas a um Espaço".
-- Isso vai limpar as tarefas e rotinas fantasma presas na Dashboard de Minhas Tarefas.
DELETE FROM public.tasks WHERE sector_id IS NULL;
DELETE FROM public.routines WHERE sector_id IS NULL;

-- 2. ALTERAR A POLÍTICA DE DELEÇÃO DO BANCO DE DADOS
-- Atualmente, quando um Setor (Espaço) é deletado, o Supabase apenas define "sector_id" 
-- como nulo nas tarefas. Precisamos que ele destrua (CASCADE) as tarefas e rotinas associadas!

-- Para a tabela 'tasks'
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_sector_id_fkey;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_sector_id_fkey
  FOREIGN KEY (sector_id)
  REFERENCES public.sectors(id)
  ON DELETE CASCADE;

-- Para a tabela 'routines'
ALTER TABLE public.routines
  DROP CONSTRAINT IF EXISTS routines_sector_id_fkey;

ALTER TABLE public.routines
  ADD CONSTRAINT routines_sector_id_fkey
  FOREIGN KEY (sector_id)
  REFERENCES public.sectors(id)
  ON DELETE CASCADE;

-- Nota: Sub-tarefas, anexos, histórico, e designações atreladas às "tasks" originais 
-- já contam com 'ON DELETE CASCADE' vinculado nativamente às tasks, portanto, 
-- ao deletar as tarefas-mãe (ou o setor), todo o lixo atrelado irá sumir num efeito dominó em cascata puro.
