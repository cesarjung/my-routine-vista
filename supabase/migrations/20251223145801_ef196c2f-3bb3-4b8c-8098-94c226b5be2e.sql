-- Create task_assignees junction table for multiple responsibles
CREATE TABLE public.task_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create subtask_assignees junction table
CREATE TABLE public.subtask_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtask_id uuid NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(subtask_id, user_id)
);

-- Create routine_assignees junction table
CREATE TABLE public.routine_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(routine_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtask_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_assignees ENABLE ROW LEVEL SECURITY;

-- Migrate existing task assignments
INSERT INTO public.task_assignees (task_id, user_id)
SELECT id, assigned_to FROM public.tasks WHERE assigned_to IS NOT NULL;

-- Migrate existing subtask assignments
INSERT INTO public.subtask_assignees (subtask_id, user_id)
SELECT id, assigned_to FROM public.subtasks WHERE assigned_to IS NOT NULL;

-- RLS Policies for task_assignees
CREATE POLICY "Admin pode gerenciar todos assignees de tarefas"
ON public.task_assignees FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode gerenciar assignees da sua unidade"
ON public.task_assignees FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.tasks t 
  WHERE t.id = task_assignees.task_id 
  AND is_unit_manager(auth.uid(), t.unit_id)
));

CREATE POLICY "Usuario pode ver assignees de tarefas da sua unidade"
ON public.task_assignees FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tasks t 
  WHERE t.id = task_assignees.task_id 
  AND t.unit_id = get_user_unit_id(auth.uid())
));

-- RLS Policies for subtask_assignees
CREATE POLICY "Admin pode gerenciar todos assignees de subtarefas"
ON public.subtask_assignees FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode gerenciar assignees de subtarefas da sua unidade"
ON public.subtask_assignees FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.subtasks s
  JOIN public.tasks t ON t.id = s.task_id
  WHERE s.id = subtask_assignees.subtask_id 
  AND is_unit_manager(auth.uid(), t.unit_id)
));

CREATE POLICY "Usuario pode ver assignees de subtarefas da sua unidade"
ON public.subtask_assignees FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.subtasks s
  JOIN public.tasks t ON t.id = s.task_id
  WHERE s.id = subtask_assignees.subtask_id 
  AND t.unit_id = get_user_unit_id(auth.uid())
));

-- RLS Policies for routine_assignees
CREATE POLICY "Admin pode gerenciar todos assignees de rotinas"
ON public.routine_assignees FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode gerenciar assignees de rotinas da sua unidade"
ON public.routine_assignees FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_assignees.routine_id 
  AND is_unit_manager(auth.uid(), r.unit_id)
));

CREATE POLICY "Usuario pode ver assignees de rotinas da sua unidade"
ON public.routine_assignees FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_assignees.routine_id 
  AND r.unit_id = get_user_unit_id(auth.uid())
));