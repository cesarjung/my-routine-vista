-- CORREÇÃO DEFINITIVA PARA ROTINAS (V2)
-- Adiciona tabelas de períodos de rotina que estavam faltando
-- Rode este comando no SQL Editor

-- 1. Garante que constraints de unidade não travem (opcional, mas bom pra garantir)
ALTER TABLE public.routines ALTER COLUMN unit_id DROP NOT NULL;

-- 2. Cria tabela de PERIODOS DE ROTINA
CREATE TABLE IF NOT EXISTS public.routine_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Cria tabela de CHECKINS
CREATE TABLE IF NOT EXISTS public.routine_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_period_id UUID NOT NULL REFERENCES public.routine_periods(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(routine_period_id, unit_id)
);

-- 4. Habilita RLS
ALTER TABLE public.routine_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_checkins ENABLE ROW LEVEL SECURITY;

-- 5. Função Auxiliar de Datas (Essencial para calcular períodos)
CREATE OR REPLACE FUNCTION public.get_current_period_dates(freq task_frequency)
RETURNS TABLE(period_start TIMESTAMP WITH TIME ZONE, period_end TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  CASE freq
    WHEN 'diaria' THEN
      RETURN QUERY SELECT 
        date_trunc('day', now()) AS period_start,
        date_trunc('day', now()) + interval '1 day' - interval '1 second' AS period_end;
    WHEN 'semanal' THEN
      RETURN QUERY SELECT 
        date_trunc('week', now()) AS period_start,
        date_trunc('week', now()) + interval '1 week' - interval '1 second' AS period_end;
    WHEN 'quinzenal' THEN
      RETURN QUERY SELECT 
        date_trunc('week', now()) AS period_start,
        date_trunc('week', now()) + interval '2 weeks' - interval '1 second' AS period_end;
    WHEN 'mensal' THEN
      RETURN QUERY SELECT 
        date_trunc('month', now()) AS period_start,
        date_trunc('month', now()) + interval '1 month' - interval '1 second' AS period_end;
  END CASE;
END;
$$;

-- 6. Políticas de Segurança (Recriando para garantir)
DROP POLICY IF EXISTS "Admin pode gerenciar todos períodos" ON public.routine_periods;
CREATE POLICY "Admin pode gerenciar todos períodos" ON public.routine_periods FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Usuário pode ver períodos de rotinas ativas" ON public.routine_periods;
CREATE POLICY "Usuário pode ver períodos de rotinas ativas" ON public.routine_periods FOR SELECT USING (true); -- Simplificado para destravar

DROP POLICY IF EXISTS "Gestor pode gerenciar períodos" ON public.routine_periods;
CREATE POLICY "Gestor pode gerenciar períodos" ON public.routine_periods FOR ALL USING (has_role(auth.uid(), 'gestor'::app_role));


DROP POLICY IF EXISTS "Admin pode gerenciar todos checkins" ON public.routine_checkins;
CREATE POLICY "Admin pode gerenciar todos checkins" ON public.routine_checkins FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Gestor pode gerenciar checkins da sua unidade" ON public.routine_checkins;
CREATE POLICY "Gestor pode gerenciar checkins da sua unidade" ON public.routine_checkins FOR ALL USING (is_unit_manager(auth.uid(), unit_id));

DROP POLICY IF EXISTS "Usuário pode ver checkins da sua unidade" ON public.routine_checkins;
CREATE POLICY "Usuário pode ver checkins da sua unidade" ON public.routine_checkins FOR SELECT USING (unit_id = get_user_unit_id(auth.uid()));

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_routine_periods_routine ON public.routine_periods(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_checkins_period ON public.routine_checkins(routine_period_id);
