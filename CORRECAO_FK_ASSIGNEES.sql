-- CORREÇÃO DE CHAVE ESTRANGEIRA (FOREIGN KEY) E CACHE DO SUPABASE
-- O erro "Could not find a relationship between 'routine_assignees' and 'user_id'" 
-- ocorre porque quando recriamos a tabela, a coluna user_id ficou "solta" sem 
-- avisar o banco que ela se liga à tabela de perfis (profiles ou auth.users).

-- 1. Adicionar a restrição de chave estrangeira que liga user_id -> profiles(id)
ALTER TABLE public.routine_assignees 
DROP CONSTRAINT IF EXISTS routine_assignees_user_id_fkey;

ALTER TABLE public.routine_assignees 
ADD CONSTRAINT routine_assignees_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Atualizar o cache do PostgREST para ele descobrir a nova ligação instantaneamente
NOTIFY pgrst, 'reload schema';
