-- Create security definer function to check if user is assigned to a routine
CREATE OR REPLACE FUNCTION public.user_is_routine_assignee(_user_id uuid, _routine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.routine_assignees
    WHERE user_id = _user_id
      AND routine_id = _routine_id
  )
$$;

-- Create security definer function to get routine's unit_id
CREATE OR REPLACE FUNCTION public.get_routine_unit_id(_routine_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id
  FROM public.routines
  WHERE id = _routine_id
$$;

-- Drop the problematic SELECT policy on routines
DROP POLICY IF EXISTS "Usuario pode ver rotinas atribuidas a ele via routine_assignees" ON public.routines;

-- Recreate using security definer function
CREATE POLICY "Usuario pode ver rotinas atribuidas a ele via routine_assignees"
ON public.routines
FOR SELECT
USING (public.user_is_routine_assignee(auth.uid(), id));

-- Drop the problematic policy on routine_assignees that causes recursion
DROP POLICY IF EXISTS "Usuario pode ver assignees de rotinas da sua unidade" ON public.routine_assignees;

-- Recreate using security definer function instead of subquery to routines
CREATE POLICY "Usuario pode ver assignees de rotinas da sua unidade"
ON public.routine_assignees
FOR SELECT
USING (
  public.get_routine_unit_id(routine_id) = public.get_user_unit_id(auth.uid())
);