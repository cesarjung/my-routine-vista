-- Add recurrence mode enum
CREATE TYPE public.recurrence_mode AS ENUM ('schedule', 'on_completion');

-- Add recurrence_mode column to routines table
ALTER TABLE public.routines 
ADD COLUMN recurrence_mode recurrence_mode NOT NULL DEFAULT 'schedule';

-- Add recurrence_mode column to tasks table (for recurring tasks)
ALTER TABLE public.tasks 
ADD COLUMN recurrence_mode recurrence_mode DEFAULT NULL,
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_frequency task_frequency DEFAULT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN public.routines.recurrence_mode IS 'schedule = creates next occurrence automatically before due date, on_completion = creates next only when current is completed';
COMMENT ON COLUMN public.tasks.recurrence_mode IS 'For recurring tasks: schedule = auto-create, on_completion = create when completed';
COMMENT ON COLUMN public.tasks.is_recurring IS 'Indicates if this is a recurring task';
COMMENT ON COLUMN public.tasks.recurrence_frequency IS 'Frequency of recurrence for recurring tasks';