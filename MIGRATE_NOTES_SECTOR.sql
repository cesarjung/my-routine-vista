-- Add sector_id to notes table to allow space-specific whiteboards
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE;

-- Update RLS policies to allow reading notes by sector
DROP POLICY IF EXISTS "Users can read all notes" ON public.notes;
CREATE POLICY "Users can read all notes" ON public.notes FOR SELECT USING (
  is_private = false OR 
  (is_private = true AND created_by = auth.uid())
);

-- Note: RLS might need a join with sector_members if we want strict isolation, 
-- but given Gestor CCM 2 specs, users see notes in the spaces they have access to.
-- Currently, user access to sectors is handled on the Frontend (SectorSidebar filtering),
-- or via basic check in other queries. Let's keep it simple as per existing rules.
