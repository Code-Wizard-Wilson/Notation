alter table public.notes
add column if not exists emoji text not null default '🐶';
