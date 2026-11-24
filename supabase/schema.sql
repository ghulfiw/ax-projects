-- AX Project Tracker: database schema
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- BEFORE RUNNING: put your own sign-in email in the last statement of this file.

create extension if not exists pgcrypto;

-- People who may use the tracker, and what they may do.
--   owner  : everything, including managing members
--   editor : edit projects, tasks and updates; comment
--   viewer : read everything; comment (your CEO)
create table public.members (
  email      text primary key check (email = lower(email)),
  name       text not null default '',
  role       text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- The signed-in person's role, or null if they are not a member.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated;

create or replace function public.my_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 120),
  area       text not null default '',
  owner      text not null default '',
  phase      text not null default 'Idea' check (phase in ('Idea', 'Scoping', 'Build', 'Pilot', 'Live')),
  status     text not null default 'ok' check (status in ('ok', 'risk', 'block', 'done')),
  next       text not null default '',
  next_date  date,
  blocker    text not null default '',
  ceo_ask    text not null default '',
  summary    text not null default '',
  sort       int  not null default 99,
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null check (length(title) between 1 and 300),
  owner      text not null default '',
  status     text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  due        date,
  done_at    date,
  created_at timestamptz not null default now()
);

create table public.updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  date       date not null default current_date,
  text       text not null check (length(text) between 1 and 2000),
  author     text not null default public.my_email(),
  created_at timestamptz not null default now()
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  body       text not null check (length(body) between 1 and 4000),
  author     text not null default public.my_email(),
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.tasks (project_id);
create index on public.updates (project_id, date desc);
create index on public.comments (project_id, created_at);

-- Row-level security: nobody outside the members list sees anything.
alter table public.members  enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.updates  enable row level security;
alter table public.comments enable row level security;

create policy members_read  on public.members for select to authenticated
  using (public.my_role() is not null);
create policy members_write on public.members for all to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

create policy projects_read  on public.projects for select to authenticated
  using (public.my_role() is not null);
create policy projects_write on public.projects for all to authenticated
  using (public.my_role() in ('owner', 'editor')) with check (public.my_role() in ('owner', 'editor'));

create policy tasks_read  on public.tasks for select to authenticated
  using (public.my_role() is not null);
create policy tasks_write on public.tasks for all to authenticated
  using (public.my_role() in ('owner', 'editor')) with check (public.my_role() in ('owner', 'editor'));

create policy updates_read  on public.updates for select to authenticated
  using (public.my_role() is not null);
create policy updates_write on public.updates for all to authenticated
  using (public.my_role() in ('owner', 'editor')) with check (public.my_role() in ('owner', 'editor'));

-- Every member (the CEO included) can comment; only the author or an editor can resolve;
-- only the author or the owner can delete.
create policy comments_read on public.comments for select to authenticated
  using (public.my_role() is not null);
create policy comments_insert on public.comments for insert to authenticated
  with check (public.my_role() is not null and author = public.my_email() and resolved = false);
create policy comments_update on public.comments for update to authenticated
  using (public.my_role() in ('owner', 'editor') or author = public.my_email())
  with check (public.my_role() in ('owner', 'editor') or author = public.my_email());
create policy comments_delete on public.comments for delete to authenticated
  using (public.my_role() = 'owner' or author = public.my_email());

-- Live refresh: other people's changes appear without reloading.
alter publication supabase_realtime add table
  public.members, public.projects, public.tasks, public.updates, public.comments;

-- The first owner. Replace the address with the email you will sign in with.
insert into public.members (email, name, role)
values (lower('replace-with-your-email@example.com'), 'Ghulfi', 'owner');
