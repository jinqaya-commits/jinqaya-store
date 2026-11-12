-- Managed homepage campaign imagery. Public visitors may read the two approved
-- slots; only catalog administrators may replace their R2 object paths.
create table if not exists public.homepage_media (
  media_key text primary key
    check (media_key in ('hero', 'lifestyle')),
  image_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint homepage_media_image_path_matches_slot
    check (
      image_path is null
      or (
        image_path like 'r2://homepage/' || media_key || '/%'
        and position('..' in image_path) = 0
      )
    )
);

alter table public.homepage_media enable row level security;

revoke all on table public.homepage_media from public;
grant select on table public.homepage_media to anon, authenticated;
grant insert, update on table public.homepage_media to authenticated;

drop policy if exists homepage_media_public_read on public.homepage_media;
create policy homepage_media_public_read
  on public.homepage_media
  for select
  to anon, authenticated
  using (true);

drop policy if exists homepage_media_admin_insert on public.homepage_media;
create policy homepage_media_admin_insert
  on public.homepage_media
  for insert
  to authenticated
  with check (public.can_manage_catalog());

drop policy if exists homepage_media_admin_update on public.homepage_media;
create policy homepage_media_admin_update
  on public.homepage_media
  for update
  to authenticated
  using (public.can_manage_catalog())
  with check (public.can_manage_catalog());

insert into public.homepage_media (media_key, image_path)
values ('hero', null), ('lifestyle', null)
on conflict (media_key) do nothing;
