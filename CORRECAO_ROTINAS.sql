-- CORREÇÃO PARA ROTINAS (Adiciona campos de recorrência)
-- Rode este comando no SQL Editor

-- 1. Criar tipo de recorrência (se não existir)
DO $$ BEGIN
    CREATE TYPE public.recurrence_mode AS ENUM ('schedule', 'on_completion');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Adicionar campos na tabela de ROTINAS
ALTER TABLE public.routines 
ADD COLUMN IF NOT EXISTS recurrence_mode recurrence_mode NOT NULL DEFAULT 'schedule';

-- 3. Adicionar campos na tabela de TAREFAS (para tarefas recorrentes soltas)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_mode recurrence_mode DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_frequency task_frequency DEFAULT NULL;
