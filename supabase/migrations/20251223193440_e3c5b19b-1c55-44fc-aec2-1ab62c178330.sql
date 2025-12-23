-- Drop and recreate task insert policies to be more permissive for regular users
DROP POLICY IF EXISTS "Usuario pode criar tarefas para si" ON public.tasks;

CREATE POLICY "Usuario pode criar tarefas para si"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can create tasks if:
  -- 1. They are the creator AND assigned to themselves AND it's their unit
  (created_by = auth.uid() AND assigned_to = auth.uid() AND unit_id = get_user_unit_id(auth.uid()))
  OR
  -- 2. They are admin or gestor (can create for anyone)
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Drop and recreate routine insert policies
DROP POLICY IF EXISTS "Usuario pode criar rotinas para si" ON public.routines;

CREATE POLICY "Usuario pode criar rotinas para si"
ON public.routines
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can create routines if:
  -- 1. They are the creator AND it's their unit (or no unit)
  (created_by = auth.uid() AND (unit_id IS NULL OR unit_id = get_user_unit_id(auth.uid())))
  OR
  -- 2. They are admin or gestor (can create for anyone)
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Also allow users to update their own tasks (ones they created or are assigned to)
DROP POLICY IF EXISTS "Usuario pode atualizar tarefas atribuidas a ele" ON public.tasks;

CREATE POLICY "Usuario pode atualizar tarefas atribuidas a ele"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR user_is_task_assignee(auth.uid(), id)
);

-- Allow users to update their own routines
DROP POLICY IF EXISTS "Usuario pode atualizar rotinas criadas por ele" ON public.routines;

CREATE POLICY "Usuario pode atualizar rotinas criadas por ele"
ON public.routines
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());