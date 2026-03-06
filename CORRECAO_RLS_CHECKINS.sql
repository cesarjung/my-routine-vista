-- Cascata RLS 2/2: Liberar tabela routine_checkins para inserção e atualização
-- O botão Iniciar Período insere o período, e imediatamente insere checkins pra cada unidade.
-- Como Usuário só tinha permissão "R" (Select), a transação inteira capotava aqui embaixo e o botão morria.

CREATE POLICY "Usuário pode inserir checkins" 
ON public.routine_checkins 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuário pode atualizar checkins" 
ON public.routine_checkins 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);
