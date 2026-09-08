create extension if not exists pgcrypto;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  plain_text_content text not null default '',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(plain_text_content, '')), 'B')
  ) stored
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('image', 'file')),
  filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  size bigint not null check (size >= 0),
  created_at timestamptz not null default now()
);

create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint note_links_not_self check (source_note_id <> target_note_id),
  constraint note_links_unique unique (source_note_id, target_note_id)
);

create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index notes_user_pinned_idx on public.notes (user_id, is_pinned, updated_at desc);
create index notes_user_archive_idx on public.notes (user_id, is_archived, is_deleted);
create index notes_search_idx on public.notes using gin (search_vector);
create index attachments_note_idx on public.attachments (note_id);
create index attachments_user_filename_idx on public.attachments (user_id, lower(filename));
create index note_links_source_idx on public.note_links (source_note_id);
create index note_links_target_idx on public.note_links (target_note_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
alter table public.attachments enable row level security;
alter table public.note_links enable row level security;

create policy "Users can read their notes"
on public.notes for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their notes"
on public.notes for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their notes"
on public.notes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can permanently delete their notes"
on public.notes for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their attachments"
on public.attachments for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create attachments for their notes"
on public.attachments for insert
to authenticated
with check (
  (select auth.uid()) = user_id and
  exists (
    select 1 from public.notes
    where notes.id = note_id and notes.user_id = (select auth.uid())
  )
);

create policy "Users can update their attachments"
on public.attachments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their attachments"
on public.attachments for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their note links"
on public.note_links for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create links between their notes"
on public.note_links for insert
to authenticated
with check (
  (select auth.uid()) = user_id and
  exists (select 1 from public.notes where id = source_note_id and user_id = (select auth.uid())) and
  exists (select 1 from public.notes where id = target_note_id and user_id = (select auth.uid()))
);

create policy "Users can delete their note links"
on public.note_links for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('note-attachments', 'note-attachments', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy "Users can read their stored attachments"
on storage.objects for select
to authenticated
using (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload stored attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their stored attachments"
on storage.objects for update
to authenticated
using (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their stored attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.attachments;
