-- Structured product dimensions for accurate storefront and AI catalogue data.
-- Existing products remain NULL until their measurements are verified.
alter table public.products
  add column if not exists dimensions jsonb;

comment on column public.products.dimensions is
  'Verified physical product measurements. Shape-aware JSON: rectangular/oval/irregular use length,width,height; round uses diameter,height; flat uses length,width; soft uses measured length,width,height plus measurement_note. Never infer missing measurements.';
