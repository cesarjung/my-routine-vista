-- CORREÇÃO CUMULATIVA (V3) - TAREFAS E ROTINAS
-- Garante que TODOS os campos faltantes em tarefas e rotinas sejam criados.
-- Pode rodar sem medo, ele verifica se já existe antes de criar.

-- 1. Campos de Recorrência (caso não tenha rodado o script 1)
DO $$ BEGIN
    CREATE TYPE public.recurrence_mode AS ENUM ('schedule', 'on_completion');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.routines 
ADD COLUMN IF NOT EXISTS recurrence_mode recurrence_mode NOT NULL DEFAULT 'schedule';

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_mode recurrence_mode DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_frequency task_frequency DEFAULT NULL;

-- 2. Hierarquia de Tarefas (O erro atual)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- 3. Garante tabela de setores nas tarefas (caso falte)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

ALTER TABLE public.routines 
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- 4. Política para ver tarefas mãe (essencial para tarefas hierárquicas)
DROP POLICY IF EXISTS "Gestor pode ver tarefas mãe das suas unidades gerenciadas" ON public.tasks;
CREATE POLICY "Gestor pode ver tarefas mãe das suas unidades gerenciadas"
ON public.tasks FOR SELECT
USING (
  parent_task_id IS NULL 
  AND EXISTS (
    SELECT 1 FROM public.unit_managers um 
    WHERE um.user_id = auth.uid()
  )
);
