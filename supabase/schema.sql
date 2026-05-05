-- Run this in Supabase SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text not null default 'Charms',
  show_for text[] not null default array['Women'],
  price numeric(10,2) not null default 0,
  qty integer not null default 0,
  description text default '',
  image_url text default '',
  date_added date default current_date,
  updated_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'submitted',
  customer jsonb not null default '{}'::jsonb,
  subtotal numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- For launch: keep read access public, but lock write access behind proper auth/service-role later.
alter table products enable row level security;
alter table orders enable row level security;

drop policy if exists "public can read active products" on products;
create policy "public can read active products" on products for select using (qty > 0);

drop policy if exists "public can submit orders" on orders;
create policy "public can submit orders" on orders for insert with check (true);

drop policy if exists "public can read own demo orders" on orders;
create policy "public can read own demo orders" on orders for select using (true);

-- Create a public bucket named product-images in Storage, then make it public.
