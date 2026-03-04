-- 1. Corrige tarefas filhas órfãs (onde a rotina não foi copiada no momento da duplicação)
UPDATE public.tasks AS child
SET routine_id = parent.routine_id
FROM public.tasks AS parent
WHERE child.parent_task_id = parent.id
  AND child.routine_id IS NULL
  AND parent.routine_id IS NOT NULL;

-- 2. Restaura os responsáveis (assignees) das tarefas filhas que foram duplicadas sem ninguém
INSERT INTO public.task_assignees (task_id, user_id)
SELECT 
    child.id AS new_task_id,
    orig_assignee.user_id
FROM public.tasks child
JOIN public.tasks parent ON child.parent_task_id = parent.id
-- Busca a tarefa original (de ontém) usando o parent_task_id original
JOIN public.tasks orig_child ON orig_child.parent_task_id = parent.parent_task_id 
    AND orig_child.unit_id = child.unit_id 
    AND orig_child.title = child.title
-- Pega os responsáveis originais
JOIN public.task_assignees orig_assignee ON orig_assignee.task_id = orig_child.id
WHERE 
  -- Apenas para tarefas que acabamos de arrumar o routine_id ou que já tinham
  child.routine_id IS NOT NULL 
  -- Apenas insere se a tarefa atual estiver vazia de responsáveis
  AND NOT EXISTS (
      SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = child.id
  );

-- 3. Restaura os responsáveis (assignees) da tarefa MÃE que foi duplicada sem responsável
INSERT INTO public.task_assignees (task_id, user_id)
SELECT 
    parent.id AS new_task_id,
    orig_assignee.user_id
FROM public.tasks parent
-- Busca a tarefa mãe original
JOIN public.tasks orig_parent ON orig_parent.id = parent.parent_task_id
-- Pega os responsáveis originais
JOIN public.task_assignees orig_assignee ON orig_assignee.task_id = orig_parent.id
WHERE 
  parent.is_recurring = true
  AND parent.routine_id IS NOT NULL 
  -- Apenas insere se a tarefa atual estiver vazia de responsáveis
  AND NOT EXISTS (
      SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = parent.id
  );
