-- Adicionar coluna parent_task_id para criar hierarquia de tarefas
ALTER TABLE public.tasks 
ADD COLUMN parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- Política para gestores verem tarefas mãe (tarefas sem unit_id específico ou com parent_task_id null)
CREATE POLICY "Gestor pode ver tarefas mãe das suas unidades gerenciadas"
ON public.tasks
FOR SELECT
USING (
  parent_task_id IS NULL 
  AND EXISTS (
    SELECT 1 FROM public.unit_managers um 
    WHERE um.user_id = auth.uid()
  )
);