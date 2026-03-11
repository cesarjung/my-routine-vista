-- SCRIPT DE REPARO ISOLADO: ROTINA "Check de Disponibilidade"
-- Este script limpa inconsistências no banco de dados apenas para a rotina solicitada.

DO $$
DECLARE
  v_routine_id UUID;
  v_date_start TIMESTAMPTZ := CURRENT_DATE::TIMESTAMPTZ;
  v_date_end TIMESTAMPTZ := (CURRENT_DATE + interval '23 hours 59 minutes 59.999 seconds')::TIMESTAMPTZ;
  v_period_count INT;
BEGIN
  -- 1. Pega o ID da rotina específica informada
  SELECT id INTO v_routine_id FROM routines WHERE title ILIKE '%Check de Disponibilidade%' AND is_active = true LIMIT 1;
  
  IF v_routine_id IS NULL THEN
     RAISE NOTICE 'Rotina "Check de Disponibilidade" não encontrada.';
     RETURN;
  END IF;

  RAISE NOTICE 'Rotina Encontrada ID: %', v_routine_id;

  -- 2. Desativa TODOS os períodos antigos que ficaram "presos" como ativos (ex: 06/03)
  UPDATE routine_periods 
  SET is_active = false 
  WHERE routine_id = v_routine_id 
  AND period_start < v_date_start
  AND is_active = true;

  -- 3. Verifica se o período exato de HOJE existe
  SELECT count(*) INTO v_period_count 
  FROM routine_periods 
  WHERE routine_id = v_routine_id 
  AND period_start >= v_date_start AND period_start <= v_date_end;

  IF v_period_count = 0 THEN
     -- Se o período de hoje não foi gerado/foi apagado, nós criamos um na marra agora
     INSERT INTO routine_periods (routine_id, period_start, period_end, is_active)
     VALUES (v_routine_id, v_date_start, v_date_end, true);
     RAISE NOTICE 'Período de HOJE criado com sucesso!';
  ELSE
     -- Se já existe, força ele a ficar ativo
     UPDATE routine_periods 
     SET is_active = true 
     WHERE routine_id = v_routine_id 
     AND period_start >= v_date_start AND period_start <= v_date_end;
     RAISE NOTICE 'Período de HOJE atualizado para ativo!';
  END IF;

  RAISE NOTICE 'Reparo concluído com sucesso para a rotina Check de Disponibilidade.';
END $$;
