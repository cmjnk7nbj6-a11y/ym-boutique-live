create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  status text default 'submitted',
  customer jsonb,
  subtotal numeric default 0,
  shipping numeric default 0,
  total numeric default 0,
  items jsonb,
  build_preview jsonb
);

alter table orders enable row level security;

drop policy if exists "Anyone can insert orders" on orders;
create policy "Anyone can insert orders"
on orders
for insert
with check (true);

drop policy if exists "Anyone can read orders for admin panel" on orders;
create policy "Anyone can read orders for admin panel"
on orders
for select
using (true);

-- If your orders table already exists, run this repair block too:
alter table orders add column if not exists status text default 'submitted';
alter table orders add column if not exists customer jsonb;
alter table orders add column if not exists subtotal numeric default 0;
alter table orders add column if not exists shipping numeric default 0;
alter table orders add column if not exists total numeric default 0;
alter table orders add column if not exists items jsonb;
alter table orders add column if not exists build_preview jsonb;
