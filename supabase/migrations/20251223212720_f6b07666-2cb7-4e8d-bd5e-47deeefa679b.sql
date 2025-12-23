-- Add status field to routine_checkins to track "not completed" state
ALTER TABLE public.routine_checkins 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'not_completed'));

-- Add assignee_user_id to routine_checkins to track who the checkin is for (instead of just unit)
ALTER TABLE public.routine_checkins 
ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES auth.users(id);

-- Update RLS policy to allow assignees to update their own checkins
CREATE POLICY "Assignee pode atualizar seu proprio checkin"
ON public.routine_checkins
FOR UPDATE
USING (assignee_user_id = auth.uid())
WITH CHECK (assignee_user_id = auth.uid());

-- Allow assignees to see their own checkins
CREATE POLICY "Assignee pode ver seu proprio checkin"
ON public.routine_checkins
FOR SELECT
USING (assignee_user_id = auth.uid());