-- Adicionar permissão de INSERT para Usuários na tabela routine_periods
-- Isso remove o bloqueio 42501 que estava silenciando o botão "Iniciar Período"

CREATE POLICY "Usuário pode inserir períodos" 
ON public.routine_periods 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Para garantir que eles também possam atualizar (caso o front precise mudar 'is_active')
CREATE POLICY "Usuário pode atualizar períodos" 
ON public.routine_periods 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);
