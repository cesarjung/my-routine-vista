-- Política para permitir apenas gestores e admins criarem tarefas
CREATE POLICY "Gestores e admins podem criar tarefas"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role) OR
  is_unit_manager(auth.uid(), unit_id)
);