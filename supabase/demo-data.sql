-- Development only. Load this file in a trusted SQL session, then call the procedure
-- with eight real, approved developer UUIDs and a real Super Admin UUID.
-- No Google identities or credentials are created. Every work note/task is marked DEMO.
create or replace procedure pg_temp.seed_syncora_demo(developers uuid[], administrator uuid)
language plpgsql as $$
declare i integer; t uuid; p uuid; m uuid; task_id uuid; log_id uuid; session_id uuid; leave_type uuid; day date:=(now() at time zone 'Asia/Colombo')::date; ids uuid[]:='{}';
begin
 if cardinality(developers)<>8 or (select count(distinct x) from unnest(developers) x)<>8 then raise exception 'Supply eight distinct real developer UUIDs'; end if;
 if (select count(*) from public.profiles where id=any(developers) and role='developer' and status='active')<>8 then raise exception 'All eight developers must already be approved and active'; end if;
 if not exists(select 1 from public.profiles where id=administrator and role='super_admin' and status='active') then raise exception 'Supply an active Super Admin'; end if;
 if exists(select 1 from public.team_memberships where developer_id=any(developers) and ends_on is null) then raise exception 'Use development accounts without existing active memberships'; end if;
 if exists(select 1 from public.tasks where title like '[DEMO]%') then raise exception 'Demo records already exist; do not seed twice'; end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 for i in 1..4 loop insert into public.teams(name) values('[DEMO] Team '||i) returning id into t;ids:=array_append(ids,t);end loop;
 insert into public.projects(name) values('[DEMO] Bailey & Glasser') returning id into p;
 insert into public.modules(project_id,name) values(p,'[DEMO] Case Details') returning id into m;
 insert into public.project_memberships(project_id,team_id) select p,unnest(ids);
 select id into leave_type from public.leave_types where active limit 1;
 for i in 1..8 loop
 t:=ids[((i-1)/2)+1];
 insert into public.team_memberships(team_id,developer_id,starts_on) values(t,developers[i],day-30);
 insert into public.tasks(title,description,team_id,project_id,module_id,assignee_id,assigned_by,status,priority,blocker,created_at,completed_at)
 values('[DEMO] Case details work '||i,'Demonstration data, not actual team progress.',t,p,m,developers[i],administrator,case when i%3=0 then 'completed'::public.task_status when i%3=1 then 'in_progress'::public.task_status else 'blocked'::public.task_status end,case when i%3=2 then 'high' else 'medium' end,case when i%3=2 then '[DEMO] Waiting for API review' else '' end,now()-interval '3 days',case when i%3=0 then now()-interval '1 day' end) returning id into task_id;
 if i in (7,8) then insert into public.leave_requests(developer_id,team_id,leave_type_id,starts_on,ends_on,half_day,status,reason,reviewed_by,reviewed_at) values(developers[i],t,leave_type,day-1,day-1,i=8,'approved','[DEMO] Example leave',administrator,now());end if;
 insert into public.daily_work_logs(developer_id,team_id,work_date,attendance,hours,completed_work,remaining_work,blockers,status,recorded_by,reviewed_by,reviewed_at)
 values(developers[i],t,day-1,case when i=7 then 'on_leave' when i=8 then 'half_day' else 'working' end,case when i=7 then 0 when i=8 then 4 else 8 end,case when i%3=0 then '[DEMO] Completed example implementation' else '' end,case when i%3<>0 then '[DEMO] Continue example testing' else '' end,case when i%3=2 then '[DEMO] API review pending' else '' end,'approved',developers[i],administrator,now()) returning id into log_id;
 insert into public.daily_task_updates(work_log_id,task_id,status,title,project_id,module_id) select log_id,id,status,title,project_id,module_id from public.tasks where id=task_id;
 insert into public.daily_work_logs(developer_id,team_id,work_date,hours,completed_work,status,recorded_by) values(developers[i],t,day,8,'[DEMO] Today’s example update',case when i%2=0 then 'submitted'::public.submission_status else 'draft'::public.submission_status end,developers[i]);
 insert into public.standup_sessions(team_id,meeting_date,period,state,notes,created_by) values(t,day,'morning','confirmed','[DEMO] Example morning plan',administrator) on conflict(team_id,meeting_date,period) do update set notes=excluded.notes returning id into session_id;
 if i%3<>0 then insert into public.standup_assignments(session_id,task_id,developer_id) values(session_id,task_id,developers[i]);end if;
 end loop;
end $$;
-- Example invocation (replace every UUID with a real development account UUID):
-- call pg_temp.seed_syncora_demo(array[...eight UUID values...]::uuid[], '...super admin UUID...'::uuid);
