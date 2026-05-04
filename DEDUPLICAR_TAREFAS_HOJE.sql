-- Limpa as tarefas e subtarefas duplicadas "fantasmas" que o Frontend gerou incorretamente ontem 
-- (Essas são as tarefas que estão bagunçando o Rastreador de hoje pois conflitam com as tarefas perfeitas geradas na madrugada)

BEGIN;

-- 1. Deleta as Subtarefas vinculadas às tarefas fantasmas
DELETE FROM public.subtasks
WHERE task_id IN (
    SELECT id FROM public.tasks
    WHERE due_date >= '2026-03-04 00:00:00-03' 
      AND due_date < '2026-03-05 00:00:00-03'
      AND created_at < '2026-03-04 00:00:00-03'
      AND is_recurring = true
);

-- 2. Deleta os responsáveis dessas tarefas
DELETE FROM public.task_assignees
WHERE task_id IN (
    SELECT id FROM public.tasks
    WHERE due_date >= '2026-03-04 00:00:00-03' 
      AND due_date < '2026-03-05 00:00:00-03'
      AND created_at < '2026-03-04 00:00:00-03'
      AND is_recurring = true
);

-- 3. Deleta as tarefas filhas fantasmas (para não dar erro de foreign key)
DELETE FROM public.tasks
WHERE due_date >= '2026-03-04 00:00:00-03' 
  AND due_date < '2026-03-05 00:00:00-03'
  AND created_at < '2026-03-04 00:00:00-03'
  AND is_recurring = true
  AND parent_task_id IS NOT NULL;

-- 4. Deleta as tarefas raízes fantasmas
DELETE FROM public.tasks
WHERE due_date >= '2026-03-04 00:00:00-03' 
  AND due_date < '2026-03-05 00:00:00-03'
  AND created_at < '2026-03-04 00:00:00-03'
  AND is_recurring = true
  AND parent_task_id IS NULL;

COMMIT;
