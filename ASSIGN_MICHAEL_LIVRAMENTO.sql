-- 1. Descobrir os IDs
DO $$
DECLARE
  v_routine_id UUID;
  v_unit_id UUID;
  v_user_id UUID;
  v_task_id UUID;
BEGIN
  -- Achar Rotina
  SELECT id INTO v_routine_id FROM routines WHERE title ILIKE '%Check de Disponibilidade%' LIMIT 1;
  
  -- Achar Unidade Livramento
  SELECT id INTO v_unit_id FROM units WHERE name ILIKE 'Livramento' LIMIT 1;
  
  -- Achar Michael Pires Prado
  SELECT id INTO v_user_id FROM profiles WHERE full_name ILIKE '%Michael Pires Prado%' LIMIT 1;
  
  -- Achar Tarefa de Livramento do dia 05/03
  SELECT id INTO v_task_id FROM tasks 
  WHERE routine_id = v_routine_id 
    AND unit_id = v_unit_id 
    AND start_date >= '2026-03-05 00:00:00'::timestamp AT TIME ZONE 'UTC'
  ORDER BY created_at DESC LIMIT 1;

  -- 2. Atualizar a Tarefa para associar o Michael
  IF v_task_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    UPDATE tasks SET assigned_to = v_user_id WHERE id = v_task_id;
    
    -- Inserir nos assignees para puxar o avatar perfeitamente
    IF NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = v_task_id AND user_id = v_user_id) THEN
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_user_id);
    END IF;
  END IF;

  -- 3. Atualizar o Checkin de Livramento tbm
  UPDATE routine_checkins SET assignee_user_id = v_user_id 
  WHERE unit_id = v_unit_id 
    AND routine_period_id IN (
      SELECT id FROM routine_periods WHERE routine_id = v_routine_id AND period_start >= '2026-03-05 00:00:00'::timestamp AT TIME ZONE 'UTC'
    );
END $$;
