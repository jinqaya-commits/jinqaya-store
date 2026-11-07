-- Harden guest checkout idempotency and restrict the privileged RPC to server-side callers.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text)'::regprocedure
  );

  v_old := $old$
  select jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'status', o.status, 'total', o.total_amount, 'currency', o.currency)
    into v_existing
    from public.orders o
   where o.checkout_idempotency_key = p_idempotency_key
   limit 1;
$old$;
  v_new := $new$
  v_email := lower(trim(coalesce(p_customer->>'email', '')));
  if length(v_email) < 5 or length(v_email) > 254 or v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' then
    raise exception 'Please enter a valid email address.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_idempotency_key));

  select jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'status', o.status, 'total', o.total_amount, 'currency', o.currency)
    into v_existing
    from public.orders o
   where o.checkout_idempotency_key = p_idempotency_key
     and lower(o.customer_email) = v_email
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  if exists (
    select 1 from public.orders o
     where o.checkout_idempotency_key = p_idempotency_key
  ) then
    raise exception 'This checkout request key has already been used. Please refresh checkout and try again.';
  end if;
$new$;

  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate idempotency lookup block; function unchanged.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  v_email := lower(trim(coalesce(p_customer->>'email', '')));
  v_first_name := trim(coalesce(p_customer->>'first_name', ''));
  v_last_name := trim(coalesce(p_customer->>'last_name', ''));
  v_phone := nullif(trim(coalesce(p_customer->>'phone', '')), '');

  if length(v_email) < 5 or length(v_email) > 254 or v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' then
    raise exception 'Please enter a valid email address.';
  end if;
$old$;
  v_new := $new$
  v_first_name := trim(coalesce(p_customer->>'first_name', ''));
  v_last_name := trim(coalesce(p_customer->>'last_name', ''));
  v_phone := nullif(trim(coalesce(p_customer->>'phone', '')), '');
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate duplicate email validation block; function unchanged.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 100 then
$old$;
  v_new := $new$
  if p_idempotency_key is null
     or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
$new$;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate idempotency key validation block; function unchanged.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END
$migration$;

REVOKE ALL ON FUNCTION public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text) TO service_role;
