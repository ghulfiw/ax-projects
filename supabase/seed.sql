-- OPTIONAL: starting data copied from the first tracker (7 projects, 13 tasks, 7 updates).
-- Run after schema.sql if you want it; skip it to start empty. Statuses and owners are drafts to correct.

insert into public.projects (name, area, owner, phase, status, next, next_date, blocker, ceo_ask, summary, sort) values
('Performance Intelligence', 'SEIN · D2C first', 'Ghulfi', 'Scoping', 'ok',
 'SEIN proposal: MCP connector pilot, web app after pilot', null, '', '',
 'Conversational agent over samsung.com and launch performance data. Demo running; proposal recommends the client''s own Claude Enterprise via MCP connector first.', 1),
('Creative Hub', 'Samsung · AI content creation', 'Ghulfi', 'Scoping', 'ok',
 'Platform build starts (3-month build)', '2026-12-01',
 'SONAR API access, Samsung security review and named reviewers still to confirm', '',
 'AI-powered content creation platform for BAU and Trendjacking briefs, with SLA monitoring (BAU 5 business days, Trendjacking 2).', 2),
('BAT', 'Cheil · non-Samsung new business', 'Ghulfi', 'Build', 'risk',
 'Add Threads as a source and role-based access', null,
 'Not on AWS yet; one part-time developer', 'Approve the R&D tools budget request (covers BAT)',
 'Business Accelerator Tools: n8n flow that finds qualified leads, moving to an AWS database and internal website.', 3),
('B2B Opportunity Tracker', 'Samsung B2B · Telesales', 'Ghulfi', 'Scoping', 'ok',
 'Agree scope with Telesales; build alongside BAT', null, '', '',
 'BAT-like tool for Samsung B2B prospects, built by the BAT team.', 4),
('Research & Benchmark', 'Cheil · launch reports and pitch research', 'Ghulfi', 'Build', 'block',
 'Get LLM and search API access for n8n', null,
 'No LLM or search API access for n8n', 'Support a request to Cheil RHQ for LLM and search API access',
 'Multi-agent framework for competitor launch reports and prospect research. Database: Supabase.', 5),
('Recruitment platform', 'Cheil HR · internal', 'Ghulfi', 'Scoping', 'ok',
 'Prototype candidate pool and pipeline for the recruiter', null, '', '',
 'In-house ATS for one recruiter and up to 20 hiring managers; minimal budget.', 6),
('Attendance to payroll', 'Cheil HR · internal', 'Ghulfi', 'Idea', 'ok',
 'Starts after the recruitment platform', null, '', '',
 'Streamline attendance data into payroll.', 7);

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
join public.projects p on p.name = t.project;

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
join public.projects p on p.name = u.project;
