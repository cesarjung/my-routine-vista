-- RESOLUÇÃO DEFINITIVA DO ERRO 400 (SCHEMA CACHE / FOREIGN KEY)
-- O PostgREST às vezes não consegue "adivinhar" que user_id se liga a profiles
-- se a chave estrangeira não for explícita para ambos os lados ou se o cache grudar.

-- 1. Remover qualquer FK quebrada/antiga que possa estar na tabela
ALTER TABLE public.routine_assignees DROP CONSTRAINT IF EXISTS routine_assignees_user_id_fkey;
ALTER TABLE public.routine_assignees DROP CONSTRAINT IF EXISTS routine_assignees_user_id_fkey1;

-- 2. Garantir que a coluna user_id realmente aponta para auth.users (Tabela Raiz de Autenticação)
ALTER TABLE public.routine_assignees 
ADD CONSTRAINT routine_assignees_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Garantir que a coluna user_id também aponta para public.profiles (Tabela de Dados Públicos)
-- Isso é crucial para a query "?select=profiles:user_id(...)" do frontend funcionar!
ALTER TABLE public.routine_assignees 
ADD CONSTRAINT routine_assignees_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. FORÇAR A ATUALIZAÇÃO DO CACHE DA API DO SUPABASE (Obrigatório para erro 400 sumir)
NOTIFY pgrst, 'reload schema';
