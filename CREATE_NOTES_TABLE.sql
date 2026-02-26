-- Create notes table
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content jsonb,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  sector_id uuid references public.sectors(id),
  is_pinned boolean default false
);

-- RLS Policies
alter table public.notes enable row level security;

-- Drop existing policies if they exist (to be safe during dev)
drop policy if exists "Users can view notes from their sector" on public.notes;
drop policy if exists "Users can create notes" on public.notes;
drop policy if exists "Users can update their own notes or sector notes" on public.notes;
drop policy if exists "Users can delete their own notes" on public.notes;

-- View: Authors see own notes, and potentially notes from their sector (if we implement sharing)
-- For now, let's make it so you can see your own notes OR notes in your sector if you are part of it?
-- Let's start with: You see notes you created.
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = created_by);

-- Create: Authenticated users can create
create policy "Users can create notes"
  on public.notes for insert
  with check (auth.uid() = created_by);

-- Update: Only author
create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = created_by);

-- Delete: Only author
create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = created_by);

-- Enable Replication for Realtime if needed
alter publication supabase_realtime add table public.notes;
