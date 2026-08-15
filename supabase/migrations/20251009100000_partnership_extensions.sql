-- Extend partners with phone
alter table if exists public.partners add column if not exists phone text;

-- Extend shared_billboards with dynamic percentages per phase
alter table if exists public.shared_billboards
  add column if not exists pre_company_pct numeric default 35 not null,
  add column if not exists pre_capital_pct numeric default 30 not null,
  add column if not exists post_company_pct numeric default 50 not null,
  add column if not exists partner_pre_pct numeric default 35 not null,
  add column if not exists partner_post_pct numeric default 50 not null;

-- Transactions table to record incomes, withdrawals, and capital deductions
create table if not exists public.shared_transactions (
  id uuid primary key default gen_random_uuid(),
  billboard_id bigint,
  partner_company_id uuid,
  beneficiary text not null,
  amount numeric not null default 0,
  type text not null check (type in ('rental_income','withdrawal','capital_deduction','adjustment')),
  notes text,
  created_at timestamptz not null default now()
);

-- Helper view to aggregate per beneficiary
create or replace view public.shared_beneficiary_summary as
select beneficiary,
  sum(case when type='rental_income' then amount else 0 end) as total_due,
  sum(case when type in ('withdrawal') then amount else 0 end) as total_paid
from public.shared_transactions
group by beneficiary;

-- RPC for supabase: shared_company_summary(beneficiary)
create or replace function public.shared_company_summary(p_beneficiary text)
returns table(total_due numeric, total_paid numeric) language sql stable as $$
  select coalesce(s.total_due,0)::numeric, coalesce(s.total_paid,0)::numeric
  from public.shared_beneficiary_summary s
  where s.beneficiary = p_beneficiary
$$;

-- Trigger to keep billboard aggregate capital in sync with shared_billboards rows
create or replace function public.sync_billboard_capital()
returns trigger language plpgsql as $$
begin
  update public.billboards b
  set capital = coalesce((select sum(capital_contribution) from public.shared_billboards where billboard_id=b.ID),0),
      capital_remaining = coalesce((select sum(capital_remaining) from public.shared_billboards where billboard_id=b.ID),0)
  where b.ID = coalesce(new.billboard_id, old.billboard_id);
  return null;
end$$;

drop trigger if exists trg_sync_billboard_capital on public.shared_billboards;
create trigger trg_sync_billboard_capital
after insert or update or delete on public.shared_billboards
for each row execute function public.sync_billboard_capital();
