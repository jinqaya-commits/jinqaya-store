-- Atomically validate and consume evidence tickets in the same transaction as case creation.
create or replace function public.submit_customer_after_sales_case(p_order_id uuid,p_token_hash text,p_description text,p_evidence_keys text[])
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_session public.after_sales_customer_sessions%rowtype; v_order public.orders%rowtype; v_case public.after_sales_cases%rowtype; v_number text; v_keys text[]:=coalesce(p_evidence_keys,'{}'::text[]); v_ticket_count integer;
begin
 select * into v_session from public.after_sales_customer_sessions where order_id=p_order_id and token_hash=p_token_hash and expires_at>now() order by created_at desc limit 1 for update;
 if not found then raise exception 'Verification expired. Please verify your email again.'; end if;
 select * into v_order from public.orders where id=p_order_id and lower(customer_email)=lower(v_session.email);
 if not found or v_order.delivered_at is null or v_order.delivered_at<now()-interval '7 days' then raise exception 'This order is not eligible for an after-sales request.'; end if;
 if length(trim(p_description))<10 or length(trim(p_description))>5000 then raise exception 'Description must be 10–5000 characters.'; end if;
 if coalesce(array_length(v_keys,1),0)<1 or coalesce(array_length(v_keys,1),0)>5 then raise exception 'Please attach 1–5 evidence files.'; end if;
 if array_length(v_keys,1)<>(select count(distinct k) from unnest(v_keys) k) then raise exception 'Duplicate evidence references are not allowed.'; end if;
 if exists(select 1 from unnest(v_keys) k where k not like 'after-sales/'||p_order_id::text||'/%' or length(k)>500) then raise exception 'Invalid evidence file reference.'; end if;
 select count(*) into v_ticket_count from public.after_sales_upload_tickets t
 where t.order_id=p_order_id and t.token_hash=p_token_hash and t.object_key=any(v_keys) and t.expires_at>now() and t.consumed_at is null;
 if v_ticket_count<>array_length(v_keys,1) then raise exception 'Evidence upload authorization expired. Please upload again.'; end if;
 v_number:='AS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.after_sales_cases(order_id,customer_id,case_number,customer_description,evidence_urls)
 values(v_order.id,v_order.customer_id,v_number,trim(p_description),v_keys) returning * into v_case;
 update public.after_sales_upload_tickets set consumed_at=now()
 where order_id=p_order_id and token_hash=p_token_hash and object_key=any(v_keys) and consumed_at is null;
 insert into public.after_sales_case_events(case_id,event_type,description,new_values)
 values(v_case.id,'customer_case_submitted','Customer submitted a quality issue request with evidence.',jsonb_build_object('case_number',v_number,'evidence_count',array_length(v_keys,1)));
 return jsonb_build_object('id',v_case.id,'case_number',v_case.case_number);
end; $function$;
