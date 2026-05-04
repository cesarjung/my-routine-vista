-- CORREÇÃO CRÍTICA: ADICIONAR COLUNA STATUS
-- O erro 'Could not find the status column' indica que esta coluna está faltando na tabela.

-- 1. Adicionar coluna 'status' na tabela routine_checkins
ALTER TABLE public.routine_checkins 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- 2. Recarregar o cache do Supabase para reconhecer a nova coluna
NOTIFY pgrst, 'reload config';
