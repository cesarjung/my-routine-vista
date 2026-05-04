-- CORREÇÃO PARA TABELA DE UNIDADES/GERÊNCIAS
-- Rode este comando no SQL Editor

-- 1. Adicionar campo para hierarquia de gerências
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.units(id) ON DELETE SET NULL;

-- 2. Índice para ficar rápido
CREATE INDEX IF NOT EXISTS idx_units_parent_id ON public.units(parent_id);
