-- ============================================================================
-- SelfAP — 0004_storage.sql
-- Two buckets, both private by default.
--
--   lesson-media  diagrams and reference sheets we author ourselves. Public
--                 read (they are part of published lessons), admin write.
--   note-files    anything a student attaches to their own notes. Private,
--                 owner-only, nothing else.
--
-- We never store copyrighted scans, textbook pages or exam PDFs here.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'lesson-media',
    'lesson-media',
    true,
    5242880,
    array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']
  ),
  (
    'note-files',
    'note-files',
    false,
    2097152,
    array['image/png','image/jpeg','image/webp','application/pdf']
  )
on conflict (id) do nothing;

-- lesson-media: anyone may read a published asset; only admins may write.
drop policy if exists "lesson-media: public read" on storage.objects;
create policy "lesson-media: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'lesson-media');

drop policy if exists "lesson-media: admin write" on storage.objects;
create policy "lesson-media: admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'lesson-media' and public.is_admin())
  with check (bucket_id = 'lesson-media' and public.is_admin());

-- note-files: owner-only, keyed on a folder named after the user's id.
drop policy if exists "note-files: owner read" on storage.objects;
create policy "note-files: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "note-files: owner write" on storage.objects;
create policy "note-files: owner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'note-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "note-files: owner update" on storage.objects;
create policy "note-files: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'note-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "note-files: owner delete" on storage.objects;
create policy "note-files: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
