-- MIGRATE_NOTES_ORDER.sql
-- Goal: Initialize position_x as a dense rank (0, 1, 2...) based on created_at DESC (Newest First)
-- This allows us to use position_x as the explicit order for the Sortable Grid.

WITH ranked_notes AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 as new_rank
  FROM public.notes
)
UPDATE public.notes
SET position_x = ranked_notes.new_rank
FROM ranked_notes
WHERE public.notes.id = ranked_notes.id;
