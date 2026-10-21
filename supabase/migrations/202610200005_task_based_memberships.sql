-- Allow membership changes after daily-note retirement without rewriting historical work.
create or replace function public.command(action text, payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=auth.uid(); today date:=(now() at time zone 'Asia/Colombo')::date;
 rid uuid:=nullif(payload->>'id','')::uuid; tid uuid:=nullif(payload->>'team_id','')::uuid;
 did uuid:=coalesce(nullif(payload->>'developer_id','')::uuid,actor);
 task tasks; log daily_work_logs; leave_row leave_requests; target profiles;
 result jsonb; item jsonb; day date; attendance jsonb; v_session_id uuid; member_id uuid;
begin
 if not is_active() then raise exception 'Active account required' using errcode='42501'; end if;
 if action='profile' then
 update profiles set name=trim(payload->>'name'),job_title=trim(payload->>'job_title') where id=actor returning to_jsonb(profiles.*) into result;
 elsif action='user' then
 if not is_super() then raise exception 'Super Admin required' using errcode='42501'; end if;
 lock table profiles in share row exclusive mode;
 select * into strict target from profiles where id=rid;
 if target.role='super_admin' and target.status='active' and (payload->>'role'<>'super_admin' or payload->>'status'<>'active') and (select count(*) from profiles where role='super_admin' and status='active')<=1 then raise exception 'Cannot remove the last active Super Admin'; end if;
 update profiles set role=(payload->>'role')::app_role,status=(payload->>'status')::account_status where id=rid returning to_jsonb(profiles.*) into result;
 elsif action in ('team','project','module','membership','project_membership','holiday','calendar','leave_type','integration') then
 if not is_super() then raise exception 'Super Admin required' using errcode='42501'; end if;
 if action='team' then
 insert into teams(id,name,archived) values(coalesce(rid,gen_random_uuid()),trim(payload->>'name'),coalesce((payload->>'archived')::boolean,false)) on conflict(id) do update set name=excluded.name,archived=excluded.archived returning to_jsonb(teams.*) into result;
 elsif action='project' then
 insert into projects(id,name,archived) values(coalesce(rid,gen_random_uuid()),trim(payload->>'name'),coalesce((payload->>'archived')::boolean,false)) on conflict(id) do update set name=excluded.name,archived=excluded.archived returning to_jsonb(projects.*) into result;
 elsif action='module' then
 insert into modules(id,project_id,name,archived) values(coalesce(rid,gen_random_uuid()),(payload->>'project_id')::uuid,trim(payload->>'name'),coalesce((payload->>'archived')::boolean,false)) on conflict(id) do update set name=excluded.name,archived=excluded.archived returning to_jsonb(modules.*) into result;
 elsif action='membership' then
 perform 1 from profiles where id=did and status='active' for update;
 if not found then raise exception 'Member must be active'; end if;
 if coalesce((payload->>'is_lead')::boolean,false) and not exists(select 1 from profiles where id=did and role in ('admin','super_admin')) then raise exception 'Team leads need an Admin role'; end if;
 if tid is not null and not exists(select 1 from teams where id=tid and not archived) then raise exception 'Select an active team'; end if;
 select id into member_id from team_memberships where developer_id=did and starts_on<=today and (ends_on is null or ends_on>today) for update;
 if member_id is not null then
 -- Membership dates change; historical work keeps its stored team_id.
 update team_memberships set ends_on=today where id=member_id;
 end if;
 if tid is not null then insert into team_memberships(team_id,developer_id,is_lead,starts_on) values(tid,did,coalesce((payload->>'is_lead')::boolean,false),today) returning to_jsonb(team_memberships.*) into result; end if;
 elsif action='project_membership' then
 if coalesce((payload->>'remove')::boolean,false) then delete from project_memberships where project_id=(payload->>'project_id')::uuid and team_id=tid;
 else insert into project_memberships(project_id,team_id) values((payload->>'project_id')::uuid,tid) on conflict do nothing; end if;
 elsif action='holiday' then
 if rid is not null and coalesce((payload->>'remove')::boolean,false) then delete from holidays where id=rid;
 else insert into holidays(holiday_date,name) values((payload->>'holiday_date')::date,trim(payload->>'name')) on conflict(holiday_date) do update set name=excluded.name returning to_jsonb(holidays.*) into result; end if;
 elsif action='calendar' then
 update working_calendar_settings set working_days=array(select jsonb_array_elements_text(payload->'working_days')::int),allowed_domains=array(select lower(jsonb_array_elements_text(payload->'allowed_domains'))) returning to_jsonb(working_calendar_settings.*) into result;
 elsif action='leave_type' then
 insert into leave_types(id,name,active) values(coalesce(rid,gen_random_uuid()),trim(payload->>'name'),coalesce((payload->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,active=excluded.active returning to_jsonb(leave_types.*) into result;
 elsif action='integration' then
 update google_sheet_integrations set enabled=(payload->>'enabled')::boolean,spreadsheet_id=payload->>'spreadsheet_id' returning to_jsonb(google_sheet_integrations.*) into result;
 end if;
 elsif action='task' then
 if rid is not null then select * into strict task from tasks where id=rid for update; tid:=task.team_id; end if;
 if rid is null then
 if not exists(select 1 from teams where id=tid and not archived) then raise exception 'Select an active team'; end if;
 if not manages(tid) then
 payload:=payload || jsonb_build_object('assignee_id',coalesce(nullif(payload->>'assignee_id','')::uuid,actor),'unplanned',false);
 if not member_of(tid,actor) or (payload->>'assignee_id')::uuid<>actor then raise exception 'Not authorized' using errcode='42501'; end if;
end if;
 elsif not manages(tid) then
 if not sees_task(rid) then raise exception 'Not authorized' using errcode='42501'; end if;
 if payload - array['id','status','blocker','expected_updated_at']::text[] <> '{}'::jsonb then raise exception 'Only your task status and blocker can be edited' using errcode='42501'; end if;
 end if;
 if rid is not null and (payload->>'expected_updated_at')::timestamptz is distinct from task.updated_at then raise exception 'Task changed. Refresh before saving.' using errcode='40001'; end if;
 if rid is null then task:=jsonb_populate_record(null::tasks,payload); task.id:=gen_random_uuid(); task.priority:=coalesce(task.priority,'medium'); task.status:=coalesce(task.status,'planned'); task.description:=coalesce(task.description,''); task.blocker:=coalesce(task.blocker,''); task.unplanned:=coalesce(task.unplanned,false);
 else task:=jsonb_populate_record(task,payload - array['id','team_id','assigned_by','created_at','updated_at','task_number','completed_at']::text[]); end if;
 if task.assignee_id is not null and (rid is null or task.assignee_id is distinct from (select assignee_id from tasks where id=rid)) and (not member_of(tid,task.assignee_id) or not exists(select 1 from profiles where id=task.assignee_id and status='active')) then raise exception 'Assignee must be an active member of this team'; end if;
 if (rid is null or task.project_id is distinct from (select project_id from tasks where id=rid)) and not can_project(task.project_id,tid) then raise exception 'Project is outside this team scope' using errcode='42501'; end if;
 if task.project_id is not null and (rid is null or task.project_id is distinct from (select project_id from tasks where id=rid)) and not exists(select 1 from projects where id=task.project_id and not archived) then raise exception 'Select an active project'; end if;
 if task.module_id is not null and (rid is null or task.module_id is distinct from (select module_id from tasks where id=rid) or task.project_id is distinct from (select project_id from tasks where id=rid)) and not exists(select 1 from modules where id=task.module_id and project_id=task.project_id and not archived) then raise exception 'Module does not belong to project'; end if;
 if task.blocker_owner is not null and (rid is null or task.blocker_owner is distinct from (select blocker_owner from tasks where id=rid)) and not member_of(tid,task.blocker_owner) then raise exception 'Blocker owner must belong to this team'; end if;
 if task.status='blocked' and trim(task.blocker)='' then raise exception 'Describe the blocker'; end if;
 task.completed_at:=case when task.status='completed' then coalesce(task.completed_at,now()) else null end;
 task.start_date:=case when task.status='in_progress' then coalesce(task.start_date,today) else task.start_date end;
 if rid is null then
 insert into tasks(id,title,description,team_id,project_id,module_id,priority,status,assignee_id,target_date,start_date,completed_at,blocker,blocker_owner,unplanned) values(task.id,task.title,task.description,tid,task.project_id,task.module_id,task.priority,task.status,task.assignee_id,task.target_date,task.start_date,task.completed_at,task.blocker,task.blocker_owner,task.unplanned) returning to_jsonb(tasks.*) into result;
 else update tasks set title=task.title,description=task.description,project_id=task.project_id,module_id=task.module_id,priority=task.priority,status=task.status,assignee_id=task.assignee_id,target_date=task.target_date,start_date=task.start_date,completed_at=task.completed_at,blocker=task.blocker,blocker_owner=task.blocker_owner where id=rid returning to_jsonb(tasks.*) into result; end if;
 elsif action='bulk_tasks' then
 for item in select value from jsonb_array_elements(payload->'tasks') loop perform command('task',item); end loop;
 elsif action='contributor' then
 select * into strict task from tasks where id=(payload->>'task_id')::uuid;
 if not manages(task.team_id) or not member_of(task.team_id,did) or not exists(select 1 from profiles where id=did and status='active') then raise exception 'Not authorized' using errcode='42501'; end if;
 if coalesce((payload->>'remove')::boolean,false) then delete from task_assignees where task_id=task.id and developer_id=did;
 else insert into task_assignees(task_id,developer_id) values(task.id,did) on conflict do nothing; end if;
 elsif action='comment' then
 if not sees_task((payload->>'task_id')::uuid) then raise exception 'Not authorized' using errcode='42501'; end if;
 insert into task_comments(task_id,body) values((payload->>'task_id')::uuid,trim(payload->>'body')) returning to_jsonb(task_comments.*) into result;
 elsif action='plan' then
 day:=(payload->>'meeting_date')::date;
 if not manages(tid) then raise exception 'Team lead required' using errcode='42501'; end if;
 insert into standup_sessions(team_id,meeting_date,period,state,notes) values(tid,day,payload->>'period',payload->>'state',coalesce(payload->>'notes','')) on conflict(team_id,meeting_date,period) do update set state=excluded.state,notes=excluded.notes where standup_sessions.updated_at=(payload->>'expected_updated_at')::timestamptz returning id into v_session_id;
 if v_session_id is null then raise exception 'Meeting changed. Refresh before saving.' using errcode='40001'; end if;
 delete from standup_assignments where session_id=v_session_id;
 for item in select value from jsonb_array_elements(payload->'assignments') loop
 select * into strict task from tasks where id=(item->>'task_id')::uuid and team_id=tid for share;
 if not member_of(tid,(item->>'developer_id')::uuid,day) or task.status in ('completed','cancelled') then raise exception 'Invalid assignment'; end if;
 if task.assignee_id is distinct from (item->>'developer_id')::uuid and not exists(select 1 from task_assignees where task_id=task.id and developer_id=(item->>'developer_id')::uuid) then raise exception 'Assign the task before planning'; end if;
 insert into standup_assignments(session_id,task_id,developer_id) values(v_session_id,task.id,(item->>'developer_id')::uuid);
 end loop;
 result:=jsonb_build_object('id',v_session_id);
 elsif action='leave' then
 if did<>actor and not is_super() then raise exception 'Request your own leave' using errcode='42501'; end if;
 select team_id into tid from team_memberships where developer_id=did and starts_on<=today and (ends_on is null or ends_on>today);
 if not exists(select 1 from leave_types where id=(payload->>'leave_type_id')::uuid and active) then raise exception 'Invalid leave type'; end if;
 insert into leave_requests(developer_id,team_id,leave_type_id,starts_on,ends_on,half_day,reason) values(did,tid,(payload->>'leave_type_id')::uuid,(payload->>'starts_on')::date,(payload->>'ends_on')::date,coalesce((payload->>'half_day')::boolean,false),coalesce(payload->>'reason','')) returning to_jsonb(leave_requests.*) into result;
 elsif action='leave_decision' then
 select * into strict leave_row from leave_requests where id=rid for update;
 perform 1 from profiles where id=leave_row.developer_id for update;
 if payload->>'status'='cancelled' then
 if not (leave_row.developer_id=actor or manages(leave_row.team_id)) or leave_row.status not in ('pending','approved') then raise exception 'Cannot cancel this request'; end if;
 elsif not manages(leave_row.team_id) or leave_row.developer_id=actor or leave_row.status<>'pending' or payload->>'status' not in ('approved','rejected') then raise exception 'Cannot review this leave request' using errcode='42501'; end if;
 if payload->>'status' in ('approved','cancelled') and exists(select 1 from daily_work_logs where developer_id=leave_row.developer_id and work_date between leave_row.starts_on and leave_row.ends_on and status in ('submitted','approved')) then raise exception 'Reopen existing work records before changing leave'; end if;
 update leave_requests set status=payload->>'status',decision_note=coalesce(payload->>'decision_note',''),reviewed_by=actor,reviewed_at=now() where id=rid returning to_jsonb(leave_requests.*) into result;
 elsif action='work_log' then
 day:=(payload->>'work_date')::date;
 if day>today then raise exception 'Cannot record future work'; end if;
 select team_id into tid from team_memberships where developer_id=did and starts_on<=day and (ends_on is null or ends_on>day);
 if not (did=actor or manages(tid)) then raise exception 'Not authorized' using errcode='42501'; end if;
 -- Serialize creation and leave decisions against this developer.
 perform 1 from profiles where id=did for update;
 select * into log from daily_work_logs where developer_id=did and work_date=day for update;
 if found then
 if log.status in ('submitted','approved') then raise exception 'Submission is locked; request a revision or reopen'; end if;
 if log.updated_at is distinct from (payload->>'expected_updated_at')::timestamptz then raise exception 'Update changed. Refresh before saving.' using errcode='40001'; end if;
 end if;
 attendance:=expected_attendance(did,day);
 if payload->>'status' not in ('draft','submitted') then raise exception 'Invalid submission state'; end if;
 insert into daily_work_logs(developer_id,team_id,work_date,attendance,hours,completed_work,remaining_work,blockers,unplanned_work,notes,status,recorded_by)
 values(did,tid,day,attendance->>'attendance',(attendance->>'hours')::numeric,coalesce(payload->>'completed_work',''),coalesce(payload->>'remaining_work',''),coalesce(payload->>'blockers',''),coalesce(payload->>'unplanned_work',''),coalesce(payload->>'notes',''),(payload->>'status')::submission_status,actor)
 on conflict(developer_id,work_date) do update set attendance=excluded.attendance,hours=excluded.hours,completed_work=excluded.completed_work,remaining_work=excluded.remaining_work,blockers=excluded.blockers,unplanned_work=excluded.unplanned_work,notes=excluded.notes,status=excluded.status,recorded_by=actor,review_note='',reviewed_by=null,reviewed_at=null returning * into log;
 delete from daily_task_updates where work_log_id=log.id and task_id not in (select (value->>'task_id')::uuid from jsonb_array_elements(coalesce(payload->'task_updates','[]')));
 for item in select value from jsonb_array_elements(coalesce(payload->'task_updates','[]')) loop
 select * into strict task from tasks where id=(item->>'task_id')::uuid and (assignee_id=did or exists(select 1 from task_assignees a where a.task_id=tasks.id and a.developer_id=did) or exists(select 1 from daily_task_updates u where u.work_log_id=log.id and u.task_id=tasks.id));
 insert into daily_task_updates(work_log_id,task_id,status,title,project_id,module_id,notes) values(log.id,task.id,task.status,task.title,task.project_id,task.module_id,coalesce(item->>'notes','')) on conflict(work_log_id,task_id) do update set status=case when day=today then excluded.status else daily_task_updates.status end,title=case when day=today then excluded.title else daily_task_updates.title end,project_id=case when day=today then excluded.project_id else daily_task_updates.project_id end,module_id=case when day=today then excluded.module_id else daily_task_updates.module_id end,notes=excluded.notes;
 end loop;
 result:=to_jsonb(log);
 elsif action='review' then
 select * into strict log from daily_work_logs where id=rid for update;
 if not manages(log.team_id) or log.developer_id=actor then raise exception 'An authorized different reviewer is required' using errcode='42501'; end if;
 if (log.status='submitted' and payload->>'status' in ('approved','revision_requested')) or (log.status='approved' and payload->>'status'='revision_requested') then
 if payload->>'status'='revision_requested' and trim(coalesce(payload->>'review_note',''))='' then raise exception 'Explain the requested revision'; end if;
 update daily_work_logs set status=(payload->>'status')::submission_status,review_note=coalesce(payload->>'review_note',''),reviewed_by=actor,reviewed_at=now() where id=rid returning to_jsonb(daily_work_logs.*) into result;
 else raise exception 'Invalid review transition'; end if;
 elsif action='snapshot' then
 if not manages(tid) then raise exception 'Team lead required' using errcode='42501'; end if;
 insert into report_snapshots(report_date,team_id,style,body) values((payload->>'report_date')::date,tid,payload->>'style',payload->>'body') returning to_jsonb(report_snapshots.*) into result;
 elsif action='export' then
 if not exists(select 1 from profiles where id=actor and role in ('admin','super_admin')) then raise exception 'Admin required' using errcode='42501'; end if;
 insert into report_exports(starts_on,ends_on,format) values((payload->>'starts_on')::date,(payload->>'ends_on')::date,payload->>'format') returning to_jsonb(report_exports.*) into result;
 else raise exception 'Unknown command'; end if;
 insert into audit_logs(actor_id,action,entity,record_id) values(actor,action,'command',coalesce(rid,nullif(result->>'id','')::uuid));
 return coalesce(result,'{}'::jsonb);
end $$;
