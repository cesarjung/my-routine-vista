-- Add assigned_to column to subtasks table
ALTER TABLE public.subtasks 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- Add RLS policy for subtask assignment
CREATE POLICY "Usuario pode ver subtarefas atribuidas a ele"
ON public.subtasks
FOR SELECT
USING (assigned_to = auth.uid());