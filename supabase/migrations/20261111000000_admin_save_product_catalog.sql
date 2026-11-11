create or replace function public.admin_save_product_catalog(
  p_product_id uuid,
  p_product jsonb,
  p_category_ids uuid[],
  p_primary_category_id uuid,
  p_variant jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_product_id uuid;
  v_category_count integer;
  v_price numeric;
  v_compare_at_price numeric;
  v_sku text;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage catalog';
  end if;
  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'Product details are required';
  end if;
  if nullif(btrim(p_product->>'name'), '') is null or nullif(btrim(p_product->>'slug'), '') is null then
    raise exception 'Product name and slug are required';
  end if;
  if coalesce(cardinality(p_category_ids), 0) = 0 or p_primary_category_id is null
     or not (p_primary_category_id = any(p_category_ids)) then
    raise exception 'Choose at least one category and one selected primary category';
  end if;

  select count(*) into v_category_count
  from public.categories c
  where c.id = any(p_category_ids) and c.is_active = true and c.parent_id is not null;
  if v_category_count <> cardinality(p_category_ids) then
    raise exception 'All selected categories must be active subcategories';
  end if;

  if p_product_id is null then
    if coalesce(p_product->>'status', 'draft') <> 'draft' then
      raise exception 'New products must be created as drafts';
    end if;
    insert into public.products (
      name, slug, pet_type, short_description, description, material,
      care_instructions, seo_title, seo_description, status, brand_name, published_at
    ) values (
      btrim(p_product->>'name'), btrim(p_product->>'slug'),
      coalesce(nullif(p_product->>'pet_type', ''), 'shared'),
      nullif(btrim(p_product->>'short_description'), ''),
      nullif(btrim(p_product->>'description'), ''),
      nullif(btrim(p_product->>'material'), ''),
      nullif(btrim(p_product->>'care_instructions'), ''),
      nullif(btrim(p_product->>'seo_title'), ''),
      nullif(btrim(p_product->>'seo_description'), ''),
      'draft'::public.product_status, 'JINQAYA', null
    ) returning id into v_product_id;
  else
    update public.products
    set name = btrim(p_product->>'name'),
        slug = btrim(p_product->>'slug'),
        pet_type = coalesce(nullif(p_product->>'pet_type', ''), 'shared'),
        short_description = nullif(btrim(p_product->>'short_description'), ''),
        description = nullif(btrim(p_product->>'description'), ''),
        material = nullif(btrim(p_product->>'material'), ''),
        care_instructions = nullif(btrim(p_product->>'care_instructions'), ''),
        seo_title = nullif(btrim(p_product->>'seo_title'), ''),
        seo_description = nullif(btrim(p_product->>'seo_description'), ''),
        status = (p_product->>'status')::public.product_status,
        published_at = case
          when (p_product->>'status')::public.product_status = 'active'::public.product_status
            then pg_catalog.now() else null end
    where id = p_product_id
    returning id into v_product_id;
    if v_product_id is null then raise exception 'Product not found or not authorized'; end if;
  end if;

  delete from public.product_categories
  where product_id = v_product_id and not (category_id = any(p_category_ids));

  insert into public.product_categories (product_id, category_id, is_primary)
  select v_product_id, selected.category_id, selected.category_id = p_primary_category_id
  from unnest(p_category_ids) as selected(category_id)
  on conflict (product_id, category_id)
  do update set is_primary = excluded.is_primary;

  if p_product_id is null and p_variant is not null then
    v_sku := nullif(btrim(p_variant->>'sku'), '');
    if v_sku is not null then
      v_price := nullif(p_variant->>'price', '')::numeric;
      v_compare_at_price := nullif(p_variant->>'compare_at_price', '')::numeric;
      if (v_price is not null and v_price < 0) or (v_compare_at_price is not null and v_compare_at_price < 0) then
        raise exception 'Prices must be non-negative';
      end if;
      insert into public.product_variants (
        product_id, sku, variant_name, color, size, price, compare_at_price, currency
      ) values (
        v_product_id, v_sku, nullif(btrim(p_variant->>'variant_name'), ''),
        nullif(btrim(p_variant->>'color'), ''), nullif(btrim(p_variant->>'size'), ''),
        v_price, v_compare_at_price, 'USD'
      );
    end if;
  end if;
  return v_product_id;
end;
$function$;

revoke all on function public.admin_save_product_catalog(uuid, jsonb, uuid[], uuid, jsonb) from public, anon;
grant execute on function public.admin_save_product_catalog(uuid, jsonb, uuid[], uuid, jsonb) to authenticated;
