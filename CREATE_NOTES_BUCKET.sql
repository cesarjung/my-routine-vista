-- Create a new storage bucket for notes
insert into storage.buckets (id, name, public)
values ('notes', 'notes', true)
on conflict (id) do nothing;

-- Set up security policies for the notes bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'notes' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'notes' and auth.role() = 'authenticated' );

create policy "Users can update their own images"
  on storage.objects for update
  using ( bucket_id = 'notes' and auth.uid() = owner );

create policy "Users can delete their own images"
  on storage.objects for delete
  using ( bucket_id = 'notes' and auth.uid() = owner );
