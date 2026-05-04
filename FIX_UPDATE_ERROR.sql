-- CORREÇÃO DE ERROS DE ATUALIZAÇÃO E SCHEMA
-- Este script corrige os erros 400 (Bad Request) e 404 (Not Found) ao atualizar tarefas/rotinas.

-- 1. Cria a tabela task_assignees se não existir
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- Referência ao auth.users ou profiles (aqui deixamos aberto ou referenciamos)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Habilita RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Políticas Simplificadas para task_assignees (Para destravar funcionamento)
DROP POLICY IF EXISTS "Permitir tudo para autenticados task_assignees" ON public.task_assignees;
CREATE POLICY "Permitir tudo para autenticados task_assignees" ON public.task_assignees FOR ALL USING (auth.role() = 'authenticated');


-- 2. Adiciona coluna faltante em routine_checkins (Causa do erro 400)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routine_checkins' AND column_name = 'assignee_user_id') THEN
        ALTER TABLE public.routine_checkins 
        ADD COLUMN assignee_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;


-- 3. Cria outras tabelas auxiliares de assignees se faltarem (por garantia)
CREATE TABLE IF NOT EXISTS public.subtask_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtask_id uuid NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(subtask_id, user_id)
);
ALTER TABLE public.subtask_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo para autenticados subtask_assignees" ON public.subtask_assignees;
CREATE POLICY "Permitir tudo para autenticados subtask_assignees" ON public.subtask_assignees FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.routine_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(routine_id, user_id)
);
ALTER TABLE public.routine_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo para autenticados routine_assignees" ON public.routine_assignees;
CREATE POLICY "Permitir tudo para autenticados routine_assignees" ON public.routine_assignees FOR ALL USING (auth.role() = 'authenticated');


-- 4. FORCE REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload config';
