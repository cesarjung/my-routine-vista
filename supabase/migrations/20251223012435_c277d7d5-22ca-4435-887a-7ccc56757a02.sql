-- Adicionar política para usuários criarem tarefas para si mesmos
CREATE POLICY "Usuario pode criar tarefas para si"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  -- Usuário pode criar tarefa desde que:
  -- 1. Seja da sua unidade
  -- 2. Seja atribuída a si mesmo
  -- 3. Não seja uma tarefa mãe (parent_task_id deve existir ou assigned_to deve ser o próprio usuário)
  unit_id = get_user_unit_id(auth.uid()) AND
  assigned_to = auth.uid() AND
  parent_task_id IS NOT NULL
);