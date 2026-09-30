-- Florida Grocery Saver – initial schema.
-- User-owned tables are protected by row level security; catalog tables
-- (stores, products, price_history) are world-readable and written by the
-- service role (price ingestion jobs, receipt processing).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: public profile mirroring auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  mpg numeric(5, 1) not null default 25,
  fuel_price numeric(5, 2) not null default 3.29,
  home_lat double precision,
  home_lng double precision,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- grocery lists
-- ---------------------------------------------------------------------------
create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index grocery_lists_user_idx on public.grocery_lists (user_id, updated_at desc);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists (id) on delete cascade,
  item_name text not null,
  quantity numeric(8, 2) not null default 1 check (quantity > 0),
  position int not null default 0
);
create index grocery_items_list_idx on public.grocery_items (list_id, position);

-- ---------------------------------------------------------------------------
-- catalog
-- ---------------------------------------------------------------------------
create table public.stores (
  id text primary key,          -- 'walmart', 'aldi', 'publix', 'winndixie'
  name text not null
);

create table public.store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores (id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores (id) on delete cascade,
  product_name text not null,
  size text,
  category text,
  keywords text[] not null default '{}',
  price numeric(8, 2) not null check (price >= 0),
  regular_price numeric(8, 2),
  deal_kind text check (deal_kind in ('bogo', 'rollback', 'special', 'promo')),
  deal_label text,
  deal_valid_through date,
  last_updated timestamptz not null default now()
);
create index products_store_idx on public.products (store_id);
create index products_keywords_idx on public.products using gin (keywords);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  price numeric(8, 2) not null,
  date_recorded date not null default current_date
);
create index price_history_product_idx on public.price_history (product_id, date_recorded);

-- Record every price change automatically.
create function public.record_price_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.price_history (product_id, price) values (new.id, new.price);
  end if;
  return new;
end;
$$;

create trigger products_price_history
  after insert or update of price on public.products
  for each row execute function public.record_price_change();

-- ---------------------------------------------------------------------------
-- alerts, receipts, usage
-- ---------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_name text not null,
  target_price numeric(8, 2) not null check (target_price > 0),
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  image_url text not null,
  store_id text references public.stores (id),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Free plan: 10 comparisons per month.
create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  list_id uuid references public.grocery_lists (id) on delete set null,
  created_at timestamptz not null default now()
);
create index comparisons_user_month_idx on public.comparisons (user_id, created_at);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;
alter table public.stores enable row level security;
alter table public.store_locations enable row level security;
alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.alerts enable row level security;
alter table public.receipts enable row level security;
alter table public.comparisons enable row level security;

create policy "users: read own" on public.users for select using (auth.uid() = id);
-- Users may edit their preferences but not their plan (billing sets that).
create policy "users: update own" on public.users for update using (auth.uid() = id)
  with check (auth.uid() = id and plan = (select u.plan from public.users u where u.id = auth.uid()));

create policy "lists: own" on public.grocery_lists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "items: via own list" on public.grocery_items for all
  using (exists (select 1 from public.grocery_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.grocery_lists l where l.id = list_id and l.user_id = auth.uid()));

create policy "stores: public read" on public.stores for select using (true);
create policy "store_locations: public read" on public.store_locations for select using (true);
create policy "products: public read" on public.products for select using (true);
create policy "price_history: public read" on public.price_history for select using (true);

create policy "alerts: own" on public.alerts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "receipts: own" on public.receipts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comparisons: read own" on public.comparisons for select using (auth.uid() = user_id);
create policy "comparisons: insert own" on public.comparisons for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- seed stores
-- ---------------------------------------------------------------------------
insert into public.stores (id, name) values
  ('walmart', 'Walmart'),
  ('aldi', 'Aldi'),
  ('publix', 'Publix'),
  ('winndixie', 'Winn-Dixie');
