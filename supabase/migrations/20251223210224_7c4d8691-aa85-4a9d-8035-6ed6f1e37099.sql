-- Add policy to allow gestors to insert routine periods
CREATE POLICY "Gestor pode criar períodos de rotinas"
ON public.routine_periods
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Add policy to allow gestors to update routine periods
CREATE POLICY "Gestor pode atualizar períodos de rotinas"
ON public.routine_periods
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Add policy to allow gestors to delete routine periods
CREATE POLICY "Gestor pode deletar períodos de rotinas"
ON public.routine_periods
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);