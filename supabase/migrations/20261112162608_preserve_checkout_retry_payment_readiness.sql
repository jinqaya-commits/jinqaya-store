-- Preserve the payment-ready flag when a guest retries an already-created checkout.
-- The original order remains authoritative; retries must return the same payment state and totals.
do $migration$
declare
  v_definition text;
  v_old text := $old$  'payment_status','not_started','currency',o.currency$old$;
  v_new text := $new$  'payment_status','not_started','payment_ready',(o.status='pending_payment'),'currency',o.currency$new$;
begin
  v_definition := pg_get_functiondef(
    'public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text)'::regprocedure
  );

  if position(v_old in v_definition) = 0 then
    if position(v_new in v_definition) > 0 then
      return;
    end if;
    raise exception 'Could not locate guest checkout idempotency response block; migration stopped.';
  end if;

  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end
$migration$;
