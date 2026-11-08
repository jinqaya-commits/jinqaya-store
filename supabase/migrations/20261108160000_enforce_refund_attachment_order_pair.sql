-- Enforce refund/attachment order ownership at the database layer.
-- The API checks this pair too, but service-role writes must not be able to
-- associate a valid refund ID with a different order ID accidentally.
create unique index if not exists order_refunds_id_order_id_uidx
 on public.order_refunds(id,order_id);

do $migration$
begin
 if not exists (
  select 1 from pg_constraint
  where conrelid='public.order_refund_attachments'::regclass
    and conname='order_refund_attachments_refund_order_fk'
 ) then
  alter table public.order_refund_attachments
   add constraint order_refund_attachments_refund_order_fk
   foreign key(refund_id,order_id)
   references public.order_refunds(id,order_id)
   on delete restrict;
 end if;
end;
$migration$;

-- Keep proof object keys scoped to the exact refund/order pair, and reject
-- malformed path segments even if a future API caller bypasses its own checks.
alter table public.order_refund_attachments
 drop constraint if exists order_refund_attachment_key_prefix;
alter table public.order_refund_attachments
 add constraint order_refund_attachment_key_prefix
 check (
  object_key like ('refund-proofs/'||order_id::text||'/'||refund_id::text||'/%')
  and length(object_key)<=500
  and length(split_part(object_key,'/',4)) between 1 and 120
  and split_part(object_key,'/',5)=''
 );
