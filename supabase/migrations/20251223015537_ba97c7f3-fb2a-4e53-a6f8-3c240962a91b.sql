-- Criar tabela de setores
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar coluna sector_id na tabela tasks (nullable para migração gradual)
ALTER TABLE public.tasks ADD COLUMN sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Adicionar coluna sector_id na tabela routines (nullable para migração gradual)
ALTER TABLE public.routines ADD COLUMN sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Habilitar RLS na tabela sectors
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Admin pode gerenciar todos os setores
CREATE POLICY "Admin pode gerenciar todos setores"
ON public.sectors
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Todos usuários autenticados podem ver setores
CREATE POLICY "Usuarios autenticados podem ver setores"
ON public.sectors
FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sectors_updated_at
BEFORE UPDATE ON public.sectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_tasks_sector_id ON public.tasks(sector_id);
CREATE INDEX idx_routines_sector_id ON public.routines(sector_id);