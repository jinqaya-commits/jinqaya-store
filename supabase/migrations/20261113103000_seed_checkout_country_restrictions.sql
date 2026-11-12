-- Keep the explicitly excluded destinations in version control.
-- Additional conflict-related exclusions should be added only after policy review.
insert into public.checkout_country_restrictions
  (country_code, country_name, reason, is_active)
values
  ('BR', 'Brazil', 'Destination excluded by store shipping policy', true),
  ('KR', 'South Korea', 'Destination excluded by store shipping policy', true)
on conflict (country_code) do update
set country_name = excluded.country_name,
    reason = excluded.reason,
    is_active = true,
    updated_at = now();
