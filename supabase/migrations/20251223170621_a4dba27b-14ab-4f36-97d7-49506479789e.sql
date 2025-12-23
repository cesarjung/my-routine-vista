-- Create security definer function to check if user is assigned to a task
CREATE OR REPLACE FUNCTION public.user_is_task_assignee(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_assignees
    WHERE user_id = _user_id
      AND task_id = _task_id
  )
$$;

-- Create security definer function to get task's unit_id
CREATE OR REPLACE FUNCTION public.get_task_unit_id(_task_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id
  FROM public.tasks
  WHERE id = _task_id
$$;

-- Drop the problematic SELECT policy on tasks
DROP POLICY IF EXISTS "Usuario pode ver tarefas atribuidas a ele via task_assignees" ON public.tasks;

-- Recreate using security definer function
CREATE POLICY "Usuario pode ver tarefas atribuidas a ele via task_assignees"
ON public.tasks
FOR SELECT
USING (public.user_is_task_assignee(auth.uid(), id));

-- Drop the problematic policy on task_assignees that causes recursion
DROP POLICY IF EXISTS "Usuario pode ver assignees de tarefas da sua unidade" ON public.task_assignees;

-- Recreate using security definer function instead of subquery to tasks
CREATE POLICY "Usuario pode ver assignees de tarefas da sua unidade"
ON public.task_assignees
FOR SELECT
USING (
  public.get_task_unit_id(task_id) = public.get_user_unit_id(auth.uid())
);

-- Also fix the gestor policy on task_assignees that queries tasks
DROP POLICY IF EXISTS "Gestor pode gerenciar assignees da sua unidade" ON public.task_assignees;

CREATE POLICY "Gestor pode gerenciar assignees da sua unidade"
ON public.task_assignees
FOR ALL
USING (
  public.is_unit_manager(auth.uid(), public.get_task_unit_id(task_id))
);