-- Add positioning and styling columns to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS position_x numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_y numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS width numeric DEFAULT 300,
ADD COLUMN IF NOT EXISTS color text DEFAULT '#ffffff';

-- Update RLS policies if necessary (usually not needed for new columns if policy covers 'all')
-- But good to ensure update policy covers these columns allows users to update them.
-- Assuming existing Update policy:
-- create policy "Users can update their own notes" on notes for update using (auth.uid() = created_by);
-- This is already sufficient.
