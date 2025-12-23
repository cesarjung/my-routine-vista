-- Remover política anterior restritiva
DROP POLICY IF EXISTS "Usuario pode criar tarefas para si" ON public.tasks;

-- Nova política: usuário pode criar tarefa desde que seja o responsável
CREATE POLICY "Usuario pode criar tarefas para si"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  -- Usuário pode criar tarefa desde que:
  -- 1. Seja da sua unidade
  -- 2. Seja atribuída a si mesmo (assigned_to = auth.uid())
  unit_id = get_user_unit_id(auth.uid()) AND
  assigned_to = auth.uid()
);