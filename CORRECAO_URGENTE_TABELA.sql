-- CORREÇÃO URGENTE: RECRIAÇÃO DE TABELAS FALTANTES
-- O erro 404 e 400 no console confirma que a tabela 'task_assignees' não existe.
-- Execute este script COMPLETO para corrigir.

-- 1. Forçar a criação da tabela task_assignees (com DROP antes para garantir)
DROP TABLE IF EXISTS public.task_assignees CASCADE;

CREATE TABLE public.task_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- Pode ser nullable se não tivermos certeza da origem, mas melhor not null
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Habilitar RLS (Segurança)
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Política de acesso permissiva para garantir que funcione agora
DROP POLICY IF EXISTS "Acesso total task_assignees" ON public.task_assignees;
CREATE POLICY "Acesso total task_assignees" ON public.task_assignees 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 2. Garantir coluna assignee_user_id na tabela routine_checkins
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routine_checkins' AND column_name = 'assignee_user_id') THEN
        ALTER TABLE public.routine_checkins 
        ADD COLUMN assignee_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. Recarregar o cache do Supabase (Essencial para parar o erro 404)
NOTIFY pgrst, 'reload config';

-- FIM
