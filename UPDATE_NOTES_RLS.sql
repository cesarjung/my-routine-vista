-- RLS Policies Update
alter table public.notes enable row level security;

-- Drop existing policies
drop policy if exists "Users can view their own notes" on public.notes;
drop policy if exists "Users can create notes" on public.notes;
drop policy if exists "Users can update their own notes" on public.notes;
drop policy if exists "Users can delete their own notes" on public.notes;

-- Create permissive policies for authenticated users (simplified for debugging)
create policy "Users can view all notes"
  on public.notes for select
  using (auth.role() = 'authenticated');

create policy "Users can create notes"
  on public.notes for insert
  with check (auth.role() = 'authenticated');

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = created_by);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = created_by);
