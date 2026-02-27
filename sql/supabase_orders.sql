-- Tabela orders para substituir SQLite
create table if not exists public.orders (
  id text primary key,
  side text not null check (side in ('buy', 'sell', 'unknown')),
  price numeric not null,
  qty numeric not null,
  status text not null check (status in ('open', 'filled', 'cancelled', 'error')) default 'open',
  filled_qty numeric not null default 0,
  "timestamp" bigint not null,
  note text null,
  external_id text null,
  pnl numeric not null default 0,
  session_id text null,
  pair_id text null
);

create index if not exists idx_orders_timestamp on public.orders using btree ("timestamp" desc);
create index if not exists idx_orders_status on public.orders using btree (status);
create index if not exists idx_orders_side on public.orders using btree (side);
create index if not exists idx_orders_pair_id on public.orders using btree (pair_id);
create index if not exists idx_orders_external_id on public.orders using btree (external_id);
