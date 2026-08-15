create table if not exists public.billboard_rental_history (
  id uuid primary key default gen_random_uuid(),
  billboard_id bigint not null,
  contract_number bigint,
  customer_id uuid,
  customer_name text,
  start_date date,
  end_date date,
  rent_amount numeric not null default 0,
  phase text check (phase in ('recovery','profit_sharing')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_billboard_rental_history_billboard on public.billboard_rental_history(billboard_id);
create index if not exists idx_billboard_rental_history_contract on public.billboard_rental_history(contract_number);
