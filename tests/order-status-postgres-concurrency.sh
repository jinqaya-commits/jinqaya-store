#!/usr/bin/env bash
set -euo pipefail

# Uses a separate fixture in the disposable PostgreSQL service, isolated from other tests.
psql -v ON_ERROR_STOP=1 -c "insert into public.orders (id, order_number, customer_email, status) values ('10000000-0000-4000-8000-000000000007', 'JQ-TEST-CONCURRENT', 'concurrent@example.test', 'processing')"
psql -v ON_ERROR_STOP=1 -Atc "select public.create_order_status_email_challenge('JQ-TEST-CONCURRENT', 'concurrent@example.test', '919191')" | grep -qx t

psql -v ON_ERROR_STOP=1 -Atc "select public.verify_order_status_email_code('JQ-TEST-CONCURRENT', 'concurrent@example.test', '919191', repeat('a',64))" > /tmp/order-status-verify-a.txt &
pid_a=$!
psql -v ON_ERROR_STOP=1 -Atc "select public.verify_order_status_email_code('JQ-TEST-1002', 'second@example.test', '919191', repeat('b',64))" > /tmp/order-status-verify-b.txt &
pid_b=$!

wait "$pid_a"
wait "$pid_b"

successes=$(grep -hxc 't' /tmp/order-status-verify-a.txt /tmp/order-status-verify-b.txt | awk '{s+=$1} END {print s+0}')
failures=$(grep -hxc 'f' /tmp/order-status-verify-a.txt /tmp/order-status-verify-b.txt | awk '{s+=$1} END {print s+0}')

if [[ "$successes" -ne 1 || "$failures" -ne 1 ]]; then
  echo "Expected exactly one successful verification and one rejection; got success=$successes failure=$failures"
  cat /tmp/order-status-verify-a.txt /tmp/order-status-verify-b.txt
  exit 1
fi

sessions=$(psql -v ON_ERROR_STOP=1 -Atc "select count(*) from public.customer_order_status_sessions where order_id='10000000-0000-4000-8000-000000000007' and token_hash in (repeat('a',64), repeat('b',64))")
if [[ "$sessions" -ne 1 ]]; then
  echo "Expected exactly one session for concurrent verification; got $sessions"
  exit 1
fi

echo "order status concurrent verification test passed"
