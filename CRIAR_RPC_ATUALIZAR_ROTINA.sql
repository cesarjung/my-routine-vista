-- FUNÇÃO RPC PARA ATUALIZAR ROTINA E TAREFAS/PERÍODOS ASSOCIADOS
-- Permite que admins e gestores atualizem as informações da rotina e sincronizem as datas das tarefas ativas e períodos.
-- Evita falhas silenciosas de RLS para gestores.

CREATE OR REPLACE FUNCTION public.update_routine_rpc(
  target_routine_id uuid,
  new_title text DEFAULT NULL,
  new_description text DEFAULT NULL,
  new_frequency task_frequency DEFAULT NULL,
  new_recurrence_mode text DEFAULT NULL,
  new_skip_weekends_holidays boolean DEFAULT NULL,
  new_monthly_anchor text DEFAULT NULL,
  new_start_date timestamp with time zone DEFAULT NULL,
  new_due_date timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  caller_role text;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  -- 1. Verificar se quem está chamando é admin ou gestor
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role NOT IN ('admin', 'gestor') THEN
     RAISE EXCEPTION 'Apenas administradores e gestores podem atualizar rotinas.';
  END IF;

  -- 2. Atualizar a tabela public.routines
  UPDATE public.routines
  SET 
    title = COALESCE(new_title, title),
    description = COALESCE(new_description, description),
    frequency = COALESCE(new_frequency, frequency),
    recurrence_mode = COALESCE(new_recurrence_mode::public.recurrence_mode, recurrence_mode),
    custom_schedule = CASE 
      WHEN new_skip_weekends_holidays IS NOT NULL OR new_monthly_anchor IS NOT NULL THEN
        jsonb_build_object(
          'skipWeekendsHolidays', COALESCE(new_skip_weekends_holidays, (custom_schedule->>'skipWeekendsHolidays')::boolean, false),
          'monthlyAnchor', COALESCE(new_monthly_anchor, custom_schedule->>'monthlyAnchor', 'date')
        )
      ELSE custom_schedule
    END,
    updated_at = now()
  WHERE id = target_routine_id;

  -- 3. Atualizar as datas das tarefas ativas da rotina (pai e filhas)
  -- Apenas tarefas com status pendente, em_andamento ou atrasada
  IF new_start_date IS NOT NULL OR new_due_date IS NOT NULL THEN
    UPDATE public.tasks
    SET
      start_date = COALESCE(new_start_date, start_date),
      due_date = COALESCE(new_due_date, due_date),
      updated_at = now()
    WHERE routine_id = target_routine_id
    AND status IN ('pendente', 'em_andamento', 'atrasada');

    -- 4. Sincronizar as datas do período ativo na tabela routine_periods
    UPDATE public.routine_periods
    SET
      period_start = COALESCE(new_start_date, period_start),
      period_end = COALESCE(new_due_date, period_end)
    WHERE routine_id = target_routine_id
    AND is_active = true;
  END IF;

END;
$$;
