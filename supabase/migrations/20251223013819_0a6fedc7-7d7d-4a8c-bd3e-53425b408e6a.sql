-- Adicionar política para usuários criarem rotinas para si mesmos
CREATE POLICY "Usuario pode criar rotinas para si" 
ON public.routines 
FOR INSERT 
WITH CHECK (created_by = auth.uid());