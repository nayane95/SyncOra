create extension if not exists btree_gist;
create type public.app_role as enum ('super_admin','admin','developer');
create type public.account_status as enum ('pending','active','rejected','inactive');
create type public.task_status as enum ('backlog','planned','in_progress','blocked','completed','cancelled');
create type public.submission_status as enum ('draft','submitted','approved','revision_requested');

create table public.profiles (
 id uuid primary key references auth.users on delete restrict,
 name text not null check(length(name) between 1 and 120), email text not null,
 role public.app_role not null default 'developer', status public.account_status not null default 'pending',
 job_title text not null default 'Developer', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.teams(id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 120), archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.team_memberships(id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams, developer_id uuid not null references public.profiles, is_lead boolean not null default false, starts_on date not null default (now() at time zone 'Asia/Colombo')::date, ends_on date, created_at timestamptz not null default now(), check(ends_on is null or ends_on>=starts_on), exclude using gist (developer_id with =, daterange(starts_on, ends_on, '[)') with &&));
create table public.projects(id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 120), archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.modules(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, name text not null check(length(name) between 1 and 120), archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,name));
create table public.project_memberships(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, team_id uuid not null references public.teams, created_at timestamptz not null default now(), unique(project_id,team_id));
create table public.tasks(
 id uuid primary key default gen_random_uuid(), task_number bigint generated always as identity unique,
 title text not null check(length(title) between 1 and 300), description text not null default '',
 team_id uuid not null references public.teams, project_id uuid references public.projects, module_id uuid references public.modules,
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')), status public.task_status not null default 'planned',
 assignee_id uuid references public.profiles, assigned_by uuid not null references public.profiles default auth.uid(),
 target_date date, start_date date, completed_at timestamptz, blocker text not null default '', blocker_owner uuid references public.profiles,
 unplanned boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.task_assignees(id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks, developer_id uuid not null references public.profiles, created_at timestamptz not null default now(), unique(task_id,developer_id));
create table public.task_status_history(id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks, old_status public.task_status, new_status public.task_status not null, assignee_id uuid references public.profiles, actor_id uuid references public.profiles, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.task_comments(id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks, author_id uuid not null references public.profiles default auth.uid(), body text not null check(length(body) between 1 and 4000), created_at timestamptz not null default now());
create table public.standup_sessions(id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams, meeting_date date not null, period text not null check(period in ('morning','evening')), state text not null default 'draft' check(state in ('draft','confirmed')), notes text not null default '', created_by uuid not null references public.profiles default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(team_id,meeting_date,period));
create table public.standup_assignments(id uuid primary key default gen_random_uuid(), session_id uuid not null references public.standup_sessions, task_id uuid not null references public.tasks, developer_id uuid not null references public.profiles, created_at timestamptz not null default now(), unique(session_id,task_id,developer_id));
create table public.leave_types(id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now());
create table public.holidays(id uuid primary key default gen_random_uuid(), holiday_date date not null unique, name text not null, created_at timestamptz not null default now());
create table public.working_calendar_settings(id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton), working_days integer[] not null default '{1,2,3,4,5}', timezone text not null default 'Asia/Colombo' check(timezone='Asia/Colombo'), allowed_domains text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(working_days <@ array[0,1,2,3,4,5,6]));
create table public.leave_requests(id uuid primary key default gen_random_uuid(), developer_id uuid not null references public.profiles default auth.uid(), team_id uuid references public.teams, leave_type_id uuid not null references public.leave_types, starts_on date not null, ends_on date not null, half_day boolean not null default false, reason text not null default '', status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')), decision_note text not null default '', reviewed_by uuid references public.profiles, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_on>=starts_on), check(not half_day or starts_on=ends_on), exclude using gist(developer_id with =, daterange(starts_on,ends_on,'[]') with &&) where(status='approved'));
create table public.daily_work_logs(id uuid primary key default gen_random_uuid(), developer_id uuid not null references public.profiles, team_id uuid references public.teams, work_date date not null, attendance text not null default 'working' check(attendance in ('working','half_day','on_leave','absent','holiday','weekend')), hours numeric(4,2) not null default 8 check(hours>=0 and hours<=24), completed_work text not null default '', remaining_work text not null default '', blockers text not null default '', unplanned_work text not null default '', notes text not null default '', status public.submission_status not null default 'draft', recorded_by uuid not null references public.profiles default auth.uid(), reviewed_by uuid references public.profiles, reviewed_at timestamptz, review_note text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(developer_id,work_date), check(attendance not in ('on_leave','absent') or hours=0));
create table public.daily_task_updates(id uuid primary key default gen_random_uuid(), work_log_id uuid not null references public.daily_work_logs, task_id uuid not null references public.tasks, status public.task_status not null, title text not null, project_id uuid references public.projects, module_id uuid references public.modules, notes text not null default '', created_at timestamptz not null default now(), unique(work_log_id,task_id));
create table public.report_snapshots(id uuid primary key default gen_random_uuid(), report_date date not null, team_id uuid not null references public.teams, style text not null check(style in ('person','team')), body text not null, created_by uuid not null references public.profiles default auth.uid(), created_at timestamptz not null default now());
create table public.report_exports(id uuid primary key default gen_random_uuid(), starts_on date not null, ends_on date not null, format text not null check(format in ('xlsx','csv')), created_by uuid not null references public.profiles default auth.uid(), created_at timestamptz not null default now(), check(ends_on>=starts_on));
create table public.google_sheet_integrations(id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton), enabled boolean not null default false, spreadsheet_id text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.sync_jobs(id uuid primary key default gen_random_uuid(), status text not null default 'running' check(status in ('running','succeeded','failed')), records integer not null default 0, error text, requested_by uuid references public.profiles, created_at timestamptz not null default now(), finished_at timestamptz);
create unique index one_running_sync on public.sync_jobs((true)) where status='running';
create table public.audit_logs(id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles, action text not null, entity text not null, record_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now());
create index tasks_team_status on public.tasks(team_id,status);
create index tasks_assignee on public.tasks(assignee_id,status);
create index work_logs_reporting on public.daily_work_logs(work_date,team_id,status);
create index memberships_scope on public.team_memberships(team_id,developer_id,starts_on,ends_on);
create index history_task_date on public.task_status_history(task_id,created_at);
create index leave_scope on public.leave_requests(team_id,starts_on,ends_on);
create index audit_date on public.audit_logs(created_at desc);
create index task_updates_log on public.daily_task_updates(work_log_id);

create function public.is_active() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and status='active') $$;
create function public.is_super() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='super_admin' and status='active') $$;
create function public.manages(t uuid) returns boolean language sql stable security definer set search_path=public as $$ select is_super() or exists(select 1 from profiles p join team_memberships m on m.developer_id=p.id where p.id=auth.uid() and p.status='active' and p.role='admin' and m.team_id=t and m.is_lead and m.starts_on<=(now() at time zone 'Asia/Colombo')::date and (m.ends_on is null or m.ends_on>(now() at time zone 'Asia/Colombo')::date)) $$;
create function public.member_of(t uuid, d uuid, on_date date default (now() at time zone 'Asia/Colombo')::date) returns boolean language sql stable security definer set search_path=public as $$ select is_active() and (d=auth.uid() or manages(t)) and exists(select 1 from team_memberships where team_id=t and developer_id=d and starts_on<=on_date and (ends_on is null or ends_on>on_date)) $$;
create function public.sees_task(t uuid) returns boolean language sql stable security definer set search_path=public as $$ select is_active() and exists(select 1 from tasks where id=t and (manages(team_id) or assignee_id=auth.uid() or exists(select 1 from task_assignees a where a.task_id=t and a.developer_id=auth.uid()))) $$;
create function public.can_project(p uuid, t uuid) returns boolean language sql stable security definer set search_path=public as $$ select is_active() and (p is null or is_super() or ((manages(t) or member_of(t,auth.uid())) and exists(select 1 from project_memberships where project_id=p and team_id=t))) $$;

create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare domains text[];
begin
 select allowed_domains into domains from working_calendar_settings limit 1;
 if cardinality(domains)>0 and not (lower(split_part(new.email,'@',2))=any(domains)) then raise exception 'Email domain is not allowed'; end if;
 insert into profiles(id,name,email) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),120),new.email);
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();

create function public.record_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' then new.updated_at=clock_timestamp(); end if;
 insert into audit_logs(actor_id,action,entity,record_id,detail) values(auth.uid(),tg_op,tg_table_name,new.id, jsonb_build_object('changed_fields',(select jsonb_agg(key) from jsonb_each(to_jsonb(new)) where tg_op='INSERT' or value is distinct from to_jsonb(old)->key)));
 return new;
end $$;
create function public.task_history() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
 insert into task_status_history(task_id,old_status,new_status,assignee_id,actor_id,detail) values(new.id,case when tg_op='UPDATE' then old.status end,new.status,new.assignee_id,auth.uid(),jsonb_build_object('blocker',new.blocker,'priority',new.priority)); end if;
 return new;
end $$;
create trigger tasks_history after insert or update on public.tasks for each row execute function public.task_history();

do $$ declare n text; begin
 foreach n in array array['profiles','teams','projects','modules','tasks','standup_sessions','working_calendar_settings','leave_requests','daily_work_logs','google_sheet_integrations'] loop
 execute format('create trigger audit_change before insert or update on public.%I for each row execute function public.record_change()',n); end loop;
 foreach n in array array['profiles','teams','team_memberships','projects','modules','project_memberships','tasks','task_assignees','task_status_history','task_comments','standup_sessions','standup_assignments','daily_work_logs','daily_task_updates','leave_types','leave_requests','holidays','working_calendar_settings','report_snapshots','report_exports','google_sheet_integrations','sync_jobs','audit_logs'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon, authenticated',n);
 execute format('grant select on public.%I to authenticated',n);
 end loop;
end $$;

create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or (is_active() and (is_super() or exists(select 1 from team_memberships m where m.developer_id=profiles.id and manages(m.team_id)))));
create policy teams_read on public.teams for select to authenticated using(is_active() and (manages(id) or member_of(id,auth.uid())));
create policy membership_read on public.team_memberships for select to authenticated using(is_active() and (developer_id=auth.uid() or manages(team_id)));
create policy project_read on public.projects for select to authenticated using(is_active() and (is_super() or exists(select 1 from project_memberships pm where pm.project_id=projects.id and (manages(pm.team_id) or member_of(pm.team_id,auth.uid()))) or exists(select 1 from tasks t where t.project_id=projects.id and sees_task(t.id))));
create policy module_read on public.modules for select to authenticated using(is_active() and exists(select 1 from projects where id=modules.project_id));
create policy project_member_read on public.project_memberships for select to authenticated using(is_active() and (manages(team_id) or member_of(team_id,auth.uid())));
create policy task_read on public.tasks for select to authenticated using(sees_task(id));
create policy contributor_read on public.task_assignees for select to authenticated using(sees_task(task_id));
create policy history_read on public.task_status_history for select to authenticated using(sees_task(task_id));
create policy comments_read on public.task_comments for select to authenticated using(sees_task(task_id));
create policy sessions_read on public.standup_sessions for select to authenticated using(is_active() and (manages(team_id) or member_of(team_id,auth.uid(),meeting_date)));
create policy assignment_read on public.standup_assignments for select to authenticated using(is_active() and (developer_id=auth.uid() or exists(select 1 from standup_sessions s where s.id=session_id and manages(s.team_id))));
create policy logs_read on public.daily_work_logs for select to authenticated using(is_active() and (developer_id=auth.uid() or manages(team_id)));
create policy updates_read on public.daily_task_updates for select to authenticated using(exists(select 1 from daily_work_logs l where l.id=work_log_id));
create policy leave_read on public.leave_requests for select to authenticated using(is_active() and (developer_id=auth.uid() or manages(team_id)));
create policy types_read on public.leave_types for select to authenticated using(is_active());
create policy holidays_read on public.holidays for select to authenticated using(is_active());
create policy calendar_read on public.working_calendar_settings for select to authenticated using(is_active());
create policy snapshots_read on public.report_snapshots for select to authenticated using(is_active() and manages(team_id));
create policy exports_read on public.report_exports for select to authenticated using(is_active() and (created_by=auth.uid() or is_super()));
create policy integrations_read on public.google_sheet_integrations for select to authenticated using(is_super());
create policy sync_read on public.sync_jobs for select to authenticated using(is_super());
create policy audit_read on public.audit_logs for select to authenticated using(is_super());

insert into public.working_calendar_settings(singleton) values(true);
insert into public.google_sheet_integrations(singleton) values(true);
insert into public.leave_types(name) values('Annual Leave'),('Casual Leave'),('Sick Leave'),('Unpaid Leave'),('Half-Day Leave'),('Other');
alter table public.profiles add constraint profile_job_title_length check(length(job_title) between 1 and 120);
alter table public.working_calendar_settings add constraint at_least_one_working_day check(cardinality(working_days)>0);
alter table public.tasks add constraint task_text_limits check(length(description)<=10000 and length(blocker)<=4000);
alter table public.daily_work_logs add constraint work_text_limits check(length(completed_work)<=10000 and length(remaining_work)<=10000 and length(blockers)<=4000 and length(unplanned_work)<=4000 and length(notes)<=4000);
alter table public.leave_requests add constraint leave_text_limits check(length(reason)<=2000 and length(decision_note)<=4000);
alter table public.report_snapshots add constraint snapshot_text_limit check(length(body)<=100000);
