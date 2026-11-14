-- Restore the homepage media read model in isolated Preview databases.
-- Production already has this table; IF NOT EXISTS keeps this migration safe there.
create table if not exists public.homepage_media (
  media_key text primary key,
  image_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint homepage_media_media_key_check
    check (media_key = any (array['hero'::text, 'lifestyle'::text])),
  constraint homepage_media_image_path_matches_slot
    check (
      image_path is null
      or (
        image_path like ('r2://homepage/' || media_key || '/%')
        and position('..' in image_path) = 0
      )
    )
);

alter table public.homepage_media enable row level security;

grant select on public.homepage_media to anon, authenticated;
grant all on public.homepage_media to service_role;

drop policy if exists homepage_media_public_read on public.homepage_media;
create policy homepage_media_public_read
  on public.homepage_media
  for select
  to anon, authenticated
  using (true);

-- Full catalog deployments have this role-check helper; the isolated checkout
-- test database intentionally does not, so leave admin writes unavailable there.
do $migration$
begin
  if to_regprocedure('public.can_manage_catalog()') is not null then
    execute 'grant insert, update on public.homepage_media to authenticated';
    execute 'drop policy if exists homepage_media_admin_insert on public.homepage_media';
    execute 'create policy homepage_media_admin_insert on public.homepage_media for insert to authenticated with check (public.can_manage_catalog())';
    execute 'drop policy if exists homepage_media_admin_update on public.homepage_media';
    execute 'create policy homepage_media_admin_update on public.homepage_media for update to authenticated using (public.can_manage_catalog()) with check (public.can_manage_catalog())';
  end if;
end
$migration$;
