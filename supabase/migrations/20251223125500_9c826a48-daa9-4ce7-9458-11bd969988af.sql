-- Allow tasks to be created without unit_id (for admins/gestors)
ALTER TABLE public.tasks ALTER COLUMN unit_id DROP NOT NULL;

-- Update RLS policy for regular users to view tasks
DROP POLICY IF EXISTS "Usuario pode ver tarefas da sua unidade" ON public.tasks;
CREATE POLICY "Usuario pode ver tarefas da sua unidade" 
ON public.tasks 
FOR SELECT 
USING (
  unit_id IS NOT NULL AND unit_id = get_user_unit_id(auth.uid())
);

-- Update RLS policy for regular users to create tasks for themselves
DROP POLICY IF EXISTS "Usuario pode criar tarefas para si" ON public.tasks;
CREATE POLICY "Usuario pode criar tarefas para si" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  (unit_id = get_user_unit_id(auth.uid()) AND assigned_to = auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gestor')
);

-- Admins and Gestors can view all tasks (including those without unit_id)
DROP POLICY IF EXISTS "Admin pode gerenciar todas tarefas" ON public.tasks;
CREATE POLICY "Admin pode gerenciar todas tarefas" 
ON public.tasks 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Gestor pode gerenciar tarefas da sua unidade" ON public.tasks;
CREATE POLICY "Gestor pode gerenciar tarefas da sua unidade" 
ON public.tasks 
FOR ALL 
USING (
  has_role(auth.uid(), 'gestor') 
  OR (unit_id IS NOT NULL AND is_unit_manager(auth.uid(), unit_id))
);

-- Gestors can also create tasks without unit
DROP POLICY IF EXISTS "Gestores e admins podem criar tarefas" ON public.tasks;
CREATE POLICY "Gestores e admins podem criar tarefas" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'gestor') 
  OR (unit_id IS NOT NULL AND is_unit_manager(auth.uid(), unit_id))
);