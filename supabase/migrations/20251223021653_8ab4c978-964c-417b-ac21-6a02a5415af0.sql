-- Adicionar campo parent_id para hierarquia de unidades (Gerências)
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.units(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_units_parent_id ON public.units(parent_id);