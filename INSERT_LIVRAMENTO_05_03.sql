-- 1. Descobre IDs
DO $$
DECLARE
  v_routine_id UUID;
  v_unit_id UUID;
  v_user_id UUID;
  v_period_id UUID;
  v_parent_task_id UUID;
BEGIN
  -- Achar Rotina
  SELECT id INTO v_routine_id FROM routines WHERE title ILIKE '%Check de Disponibilidade%' LIMIT 1;
  
  -- Achar Unidade
  SELECT id INTO v_unit_id FROM units WHERE name ILIKE 'Livramento' LIMIT 1;
  
  -- Achar User
  SELECT user_id INTO v_user_id FROM unit_managers WHERE unit_id = v_unit_id LIMIT 1;
  
  -- Achar Periodo do dia 05
  SELECT id INTO v_period_id FROM routine_periods 
  WHERE routine_id = v_routine_id AND period_start >= '2026-03-05 00:00:00'::timestamp AT TIME ZONE 'UTC' 
  ORDER BY created_at DESC LIMIT 1;
  
  -- Achar Task Pai do dia 05
  SELECT id INTO v_parent_task_id FROM tasks 
  WHERE routine_id = v_routine_id AND parent_task_id IS NULL AND start_date >= '2026-03-05 00:00:00'::timestamp AT TIME ZONE 'UTC'
  ORDER BY created_at DESC LIMIT 1;

  -- 2. Inserir Checkin se não existir
  IF NOT EXISTS (SELECT 1 FROM routine_checkins WHERE routine_period_id = v_period_id AND unit_id = v_unit_id) THEN
    INSERT INTO routine_checkins (routine_period_id, unit_id, assignee_user_id, status)
    VALUES (v_period_id, v_unit_id, v_user_id, 'pending');
  END IF;

  -- 3. Inserir Task se não existir
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE parent_task_id = v_parent_task_id AND unit_id = v_unit_id) THEN
    INSERT INTO tasks (title, description, routine_id, parent_task_id, unit_id, sector_id, assigned_to, created_by, start_date, due_date, status)
    SELECT title, description, routine_id, id, v_unit_id, sector_id, v_user_id, v_user_id, start_date, due_date, 'pendente'
    FROM tasks WHERE id = v_parent_task_id;
  END IF;

END $$;
