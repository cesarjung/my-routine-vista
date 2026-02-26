-- Create note_attachments table
create table if not exists note_attachments (
  id uuid default gen_random_uuid() primary key,
  note_id uuid references notes(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references profiles(id)
);

-- RLS Policies
alter table note_attachments enable row level security;

drop policy if exists "Users can view attachments for their notes" on note_attachments;
create policy "Users can view attachments for their notes"
  on note_attachments for select
  using ( exists ( select 1 from notes where notes.id = note_attachments.note_id and notes.created_by = auth.uid() ) );

drop policy if exists "Users can insert attachments for their notes" on note_attachments;
create policy "Users can insert attachments for their notes"
  on note_attachments for insert
  with check ( exists ( select 1 from notes where notes.id = note_attachments.note_id and notes.created_by = auth.uid() ) );

drop policy if exists "Users can delete attachments for their notes" on note_attachments;
create policy "Users can delete attachments for their notes"
  on note_attachments for delete
  using ( exists ( select 1 from notes where notes.id = note_attachments.note_id and notes.created_by = auth.uid() ) );
