-- Política para permitir apenas gestores e admins criarem rotinas
CREATE POLICY "Gestores e admins podem criar rotinas"
ON public.routines
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role) OR
  is_unit_manager(auth.uid(), unit_id)
);