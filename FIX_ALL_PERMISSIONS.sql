-- ==========================================
-- FIX ALL PERMISSIONS SCRIPT (UPDATED & IDEMPOTENT)
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. FIX NOTES TABLE PERMISSIONS
alter table public.notes enable row level security;

-- Drop ALL POTENTIAL existing policies to avoid conflicts
drop policy if exists "Users can view their own notes" on public.notes;
drop policy if exists "Users can view all notes" on public.notes;
drop policy if exists "Users can create notes" on public.notes;
drop policy if exists "Users can update their own notes" on public.notes;
drop policy if exists "Users can delete their own notes" on public.notes;
drop policy if exists "Enable read access for authenticated users" on public.notes;
drop policy if exists "Enable insert access for authenticated users" on public.notes;
drop policy if exists "Enable update access for users based on created_by" on public.notes;
drop policy if exists "Enable delete access for users based on created_by" on public.notes;

-- Create OPEN policies for authenticated users
create policy "Enable read access for authenticated users"
on public.notes for select
to authenticated
using (true);

create policy "Enable insert access for authenticated users"
on public.notes for insert
to authenticated
with check (true);

create policy "Enable update access for users based on created_by"
on public.notes for update
to authenticated
using (auth.uid() = created_by);

create policy "Enable delete access for users based on created_by"
on public.notes for delete
to authenticated
using (auth.uid() = created_by);


-- 2. FIX ATTACHMENTS TABLE
alter table public.note_attachments enable row level security;

drop policy if exists "Users can view attachments for their notes" on note_attachments;
drop policy if exists "Users can insert attachments for their notes" on note_attachments;
drop policy if exists "Users can delete attachments for their notes" on note_attachments;
drop policy if exists "Enable all access for attachments" on note_attachments;

create policy "Enable all access for attachments"
on public.note_attachments
for all
to authenticated
using (true)
with check (true);


-- 3. FIX STORAGE BUCKET (For Downloads)
insert into storage.buckets (id, name, public)
values ('notes', 'notes', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Users can update their own images" on storage.objects;
drop policy if exists "Users can delete their own images" on storage.objects;
drop policy if exists "Give users access to own folder 1we10s_0" on storage.objects;
drop policy if exists "Give users access to own folder 1we10s_1" on storage.objects;
drop policy if exists "Give users access to own folder 1we10s_2" on storage.objects;
drop policy if exists "Give users access to own folder 1we10s_3" on storage.objects;

-- Allow everything for authenticated users in 'notes' bucket
create policy "Give users access to own folder 1we10s_0" 
on storage.objects for select 
to public 
using (bucket_id = 'notes'); 

create policy "Give users access to own folder 1we10s_1" 
on storage.objects for insert 
to public 
with check (bucket_id = 'notes');

create policy "Give users access to own folder 1we10s_2" 
on storage.objects for update 
to public 
using (bucket_id = 'notes');

create policy "Give users access to own folder 1we10s_3" 
on storage.objects for delete 
to public 
using (bucket_id = 'notes');
