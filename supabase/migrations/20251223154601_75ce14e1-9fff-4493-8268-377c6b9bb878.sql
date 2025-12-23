-- Adicionar policy para usuário ver tarefas onde é assignee
CREATE POLICY "Usuario pode ver tarefas atribuidas a ele via task_assignees"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
);

-- Adicionar policy para usuário ver rotinas onde é assignee
CREATE POLICY "Usuario pode ver rotinas atribuidas a ele via routine_assignees"
ON public.routines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.routine_assignees
    WHERE routine_assignees.routine_id = routines.id 
    AND routine_assignees.user_id = auth.uid()
  )
);

-- Adicionar policy para usuário ver tarefas do setor dele
CREATE POLICY "Usuario pode ver tarefas do seu setor"
ON public.tasks
FOR SELECT
USING (
  sector_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.sector_users
    WHERE sector_users.sector_id = tasks.sector_id
    AND sector_users.user_id = auth.uid()
  )
);

-- Adicionar policy para usuário ver rotinas do setor dele
CREATE POLICY "Usuario pode ver rotinas do seu setor"
ON public.routines
FOR SELECT
USING (
  sector_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.sector_users
    WHERE sector_users.sector_id = routines.sector_id
    AND sector_users.user_id = auth.uid()
  )
);