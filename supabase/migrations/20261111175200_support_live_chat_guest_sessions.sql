alter table public.support_tickets
  add column if not exists visitor_id uuid,
  add column if not exists session_id uuid references public.visitor_sessions(id) on delete set null,
  add column if not exists guest_token_hash text,
  add column if not exists source text,
  add column if not exists page_url text,
  add column if not exists last_message_at timestamptz,
  add column if not exists unread_by_staff integer not null default 0,
  add column if not exists unread_by_customer integer not null default 0;

alter table public.support_tickets
  drop constraint if exists support_tickets_unread_counts_nonnegative;

alter table public.support_tickets
  add constraint support_tickets_unread_counts_nonnegative
  check (unread_by_staff >= 0 and unread_by_customer >= 0);

create unique index if not exists support_tickets_guest_token_hash_uidx
  on public.support_tickets (guest_token_hash)
  where guest_token_hash is not null;

create index if not exists support_tickets_visitor_last_message_idx
  on public.support_tickets (visitor_id, last_message_at desc)
  where visitor_id is not null;

create index if not exists support_tickets_last_message_idx
  on public.support_tickets (last_message_at desc nulls last);

create index if not exists support_messages_ticket_created_public_idx
  on public.support_messages (ticket_id, created_at)
  where is_internal = false;

comment on column public.support_tickets.guest_token_hash is
  'SHA-256 hash of the random guest chat access token. The raw token is never stored.';
comment on column public.support_tickets.visitor_id is
  'Anonymous visitor identifier, populated only when the visitor opted into website analytics.';
comment on column public.support_tickets.session_id is
  'Analytics session associated with this chat, populated only after analytics consent.';
