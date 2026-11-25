-- AX Project Tracker: update 004 — Roadmap
-- Run once, after migration-003.sql. Running it twice does no harm.
--
-- An "offer" is one way a project earns (or saves) money: e.g. Business Intelligence for SEIN,
-- and Business Intelligence for NSS clients. Each offer has its market, business model,
-- planned build / pilot / live months, expected 2027 revenue and how confident that figure is.
-- Months are stored as the first day of the month; a "to" month means "through the end of that month".

create table if not exists public.offers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null default '' check (length(name) <= 160),
  market       text not null default 'SEIN' check (market in ('SEIN', 'NSS', 'Internal')),
  model        text not null default '' check (length(model) <= 300),
  build_from   date,
  build_to     date,
  pilot_from   date,
  pilot_to     date,
  live_from    date,
  revenue_2027 numeric(16, 0) check (revenue_2027 is null or revenue_2027 >= 0),
  confidence   text not null default 'Target' check (confidence in ('Target', 'Quoted', 'Committed')),
  sort         int  not null default 99,
  created_at   timestamptz not null default now()
);

create index if not exists offers_project_id_idx on public.offers (project_id);

alter table public.offers enable row level security;

drop policy if exists offers_read on public.offers;
create policy offers_read on public.offers for select to authenticated
  using (public.my_role() is not null);

drop policy if exists offers_write on public.offers;
create policy offers_write on public.offers for all to authenticated
  using (public.my_role() in ('owner', 'editor')) with check (public.my_role() in ('owner', 'editor'));

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers') then
    alter publication supabase_realtime add table public.offers;
  end if;
end
$$;
