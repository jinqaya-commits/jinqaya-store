-- Extend the existing homepage_media table (created by the earlier
-- homepage media settings migration) with audit metadata and stricter access.
alter table public.homepage_media
  add column if not exists updated_by uuid
  references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.homepage_media'::regclass
      and conname = 'homepage_media_image_path_matches_slot'
  ) then
    alter table public.homepage_media
      add constraint homepage_media_image_path_matches_slot
      check (
        image_path is null
        or (
          image_path like 'r2://homepage/' || media_key || '/%'
          and position('..' in image_path) = 0
        )
      );
  end if;
end
$$;

alter table public.homepage_media enable row level security;

-- Remove inherited broad table grants and the previous ALL policy. The
-- storefront needs SELECT; catalog managers need INSERT/UPDATE only.
revoke all on table public.homepage_media from public, anon, authenticated;
grant select on table public.homepage_media to anon, authenticated;
grant insert, update on table public.homepage_media to authenticated;

drop policy if exists "Catalog managers manage homepage media" on public.homepage_media;
drop policy if exists "Public can read homepage media" on public.homepage_media;
drop policy if exists homepage_media_public_read on public.homepage_media;
drop policy if exists homepage_media_admin_insert on public.homepage_media;
drop policy if exists homepage_media_admin_update on public.homepage_media;

create policy homepage_media_public_read
  on public.homepage_media
  for select
  to anon, authenticated
  using (true);

create policy homepage_media_admin_insert
  on public.homepage_media
  for insert
  to authenticated
  with check (public.can_manage_catalog());

create policy homepage_media_admin_update
  on public.homepage_media
  for update
  to authenticated
  using (public.can_manage_catalog())
  with check (public.can_manage_catalog());

insert into public.homepage_media (media_key, image_path)
values ('hero', null), ('lifestyle', null)
on conflict (media_key) do nothing;
