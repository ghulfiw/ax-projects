-- AX Project Tracker: update 002
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- Safe to run on the database you set up with schema.sql. Running it twice does no harm.
--
-- What it does:
--   1. Adds a "related department" to each project.
--   2. Removes the "decision needed from CEO" field (the panel is gone from the app).
--   3. Lets people comment on tasks as well as projects.
--   4. Loads the starting projects, tasks and updates (skips any project name that already exists).

-- 1. Department
alter table public.projects add column if not exists department text not null default '';

-- 2. CEO decision field
alter table public.projects drop column if exists ceo_ask;

-- 3. Comments on tasks: a comment belongs to a project, and optionally to one of its tasks.
alter table public.comments add column if not exists task_id uuid references public.tasks (id) on delete cascade;
create index if not exists comments_task_id_idx on public.comments (task_id);

-- Keep a task comment's project in step with its task.
create or replace function public.comments_fill_project()
returns trigger
language plpgsql
as $$
begin
  if new.task_id is not null then
    select t.project_id into new.project_id from public.tasks t where t.id = new.task_id;
    if new.project_id is null then
      raise exception 'Task not found';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists comments_fill_project on public.comments;
create trigger comments_fill_project
  before insert or update of task_id on public.comments
  for each row execute function public.comments_fill_project();

-- 4. Starting data (statuses, owners and departments are drafts to correct in the app)
insert into public.projects (name, area, department, owner, phase, status, next, next_date, blocker, summary, sort)
select v.name, v.area, v.department, v.owner, v.phase, v.status, v.next, v.next_date::date, v.blocker, v.summary, v.sort
from (values
  ('Performance Intelligence', 'SEIN · D2C first', 'Digital (SEIN account)', 'Ghulfi', 'Scoping', 'ok',
   'SEIN proposal: MCP connector pilot, web app after pilot', null, '',
   'Conversational agent over samsung.com and launch performance data. Demo running; proposal recommends the client''s own Claude Enterprise via MCP connector first.', 1),
  ('Creative Hub', 'Samsung · AI content creation', 'Creative', 'Ghulfi', 'Scoping', 'ok',
   'Platform build starts (3-month build)', '2026-12-01',
   'SONAR API access, Samsung security review and named reviewers still to confirm',
   'AI-powered content creation platform for BAU and Trendjacking briefs, with SLA monitoring (BAU 5 business days, Trendjacking 2).', 2),
  ('BAT', 'Cheil · non-Samsung new business', 'New Business', 'Ghulfi', 'Build', 'risk',
   'Add Threads as a source and role-based access', null,
   'Not on AWS yet; one part-time developer',
   'Business Accelerator Tools: n8n flow that finds qualified leads, moving to an AWS database and internal website.', 3),
  ('B2B Opportunity Tracker', 'Samsung B2B · Telesales', 'B2B (Telesales)', 'Ghulfi', 'Scoping', 'ok',
   'Agree scope with Telesales; build alongside BAT', null, '',
   'BAT-like tool for Samsung B2B prospects, built by the BAT team.', 4),
  ('Research & Benchmark', 'Cheil · launch reports and pitch research', 'Strategy', 'Ghulfi', 'Build', 'block',
   'Get LLM and search API access for n8n', null,
   'No LLM or search API access for n8n',
   'Multi-agent framework for competitor launch reports and prospect research. Database: Supabase.', 5),
  ('Recruitment platform', 'Cheil HR · internal', 'HR', 'Ghulfi', 'Scoping', 'ok',
   'Prototype candidate pool and pipeline for the recruiter', null, '',
   'In-house ATS for one recruiter and up to 20 hiring managers; minimal budget.', 6),
  ('Attendance to payroll', 'Cheil HR · internal', 'HR & Finance', 'Ghulfi', 'Idea', 'ok',
   'Starts after the recruitment platform', null, '',
   'Streamline attendance data into payroll.', 7)
) as v(name, area, department, owner, phase, status, next, next_date, blocker, summary, sort)
where not exists (select 1 from public.projects p where p.name = v.name);

insert into public.tasks (project_id, title, owner, status, done_at)
select p.id, t.title, t.owner, t.status, t.done_at::date
from (values
  ('Creative Hub', 'Quote three module options for Samsung (FTE, R&R, cost, SLA)', 'Ghulfi', 'doing', null),
  ('Creative Hub', 'Confirm SONAR API access', 'Ghulfi', 'todo', null),
  ('Creative Hub', 'Finish the working client demo', 'Ghulfi', 'doing', null),
  ('BAT', 'Submit R&D tools budget request', 'Ghulfi', 'doing', null),
  ('BAT', 'Add Threads as a lead source', '', 'todo', null),
  ('BAT', 'Add role-based access management', '', 'todo', null),
  ('Research & Benchmark', 'Request LLM and search API access from Cheil RHQ', 'Ghulfi', 'todo', null),
  ('Research & Benchmark', 'Set up Supabase schema', 'Ghulfi', 'doing', null),
  ('Performance Intelligence', 'Finalise SEIN proposal deck', 'Ghulfi', 'review', null),
  ('Performance Intelligence', 'Follow up with Cheil India GDC on the Optimizer data pipeline', 'Ghulfi', 'todo', null),
  ('B2B Opportunity Tracker', 'Agree B2B Opportunity Tracker scope with Telesales', 'Ghulfi', 'doing', null),
  ('Recruitment platform', 'Write recruitment platform requirements', 'Ghulfi', 'done', '2026-11-23'),
  ('Recruitment platform', 'Prototype candidate pool and pipeline', 'Ghulfi', 'todo', null)
) as t(project, title, owner, status, done_at)
join public.projects p on p.name = t.project
where not exists (select 1 from public.tasks x where x.project_id = p.id and x.title = t.title);

insert into public.updates (project_id, date, text, author)
select p.id, u.date::date, u.text, ''
from (values
  ('Creative Hub', '2026-11-18', 'Met Samsung: they asked for the offer split into five modules and quoted as three options (full stack, modules 3–5, production only).'),
  ('Creative Hub', '2026-11-17', 'Workflow v3 agreed; SLA set at 5 business days for BAU and 2 for Trendjacking.'),
  ('BAT', '2026-11-17', 'Confirmed next steps: Threads as a new source, role-based access, and presenting BAT to other Cheil departments.'),
  ('BAT', '2026-11-24', 'R&D tools budget request (incl. BAT) being prepared for submission.'),
  ('Research & Benchmark', '2026-11-23', 'Took over the framework from its original owner; chose Supabase as the database.'),
  ('Recruitment platform', '2026-11-23', 'Requirements set: about 5–10 open roles a month, up to 20 hiring-manager users, email updates.'),
  ('B2B Opportunity Tracker', '2026-11-17', 'Scoping started as a companion tool to BAT for Samsung B2B Telesales.')
) as u(project, date, text)
join public.projects p on p.name = u.project
where not exists (select 1 from public.updates x where x.project_id = p.id and x.text = u.text);
