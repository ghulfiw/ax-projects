-- AX Project Tracker: update 003
-- Run once, after migration-002.sql. Running it twice does no harm.
--
-- What it does:
--   1. A project can have several related (internal Cheil) departments.
--   2. Client is its own field: SEIN, NSS (non-Samsung client) or Internal (no client),
--      plus an optional client team or name (e.g. "B2B", "D2C", or an NSS client's name).
--   3. Carries existing single-department text over (split on commas and "&"), then removes the old column.

alter table public.projects add column if not exists departments text[] not null default '{}';
alter table public.projects add column if not exists client text not null default 'Internal';
alter table public.projects add column if not exists client_detail text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_client_check') then
    alter table public.projects add constraint projects_client_check check (client in ('SEIN', 'NSS', 'Internal'));
  end if;
end
$$;

-- Carry the old single "department" text over, if that column still exists.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects' and column_name = 'department') then
    execute $q$
      update public.projects p
      set departments = coalesce((
            select array_agg(trim(x)) filter (where trim(x) <> '')
            from unnest(regexp_split_to_array(p.department, '\s*(,|&)\s*')) as x
          ), '{}')
      where p.departments = '{}' and p.department <> ''
    $q$;
    alter table public.projects drop column department;
  end if;
end
$$;
