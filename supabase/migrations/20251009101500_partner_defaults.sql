-- Partner-level default partnership settings
alter table if exists public.partners
  add column if not exists default_partner_pre_pct numeric not null default 35,
  add column if not exists default_partner_post_pct numeric not null default 50,
  add column if not exists default_capital_contribution numeric not null default 0,
  add column if not exists notes text;

-- Strengthen shared_transactions link to partners when known
do $$ begin
  alter table if exists public.shared_transactions
    add constraint shared_transactions_partner_fk foreign key (partner_company_id) references public.partners(id) on delete set null;
exception when duplicate_object then null; end $$;
