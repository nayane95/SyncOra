-- Run in a trusted SQL session. Keep test activity inside [TEST] Sandbox.
begin;
do $$
declare
 administrator uuid;
 t constant uuid := '5c0a0000-0000-4000-8000-000000000001';
 p uuid; m uuid; task_id uuid; session_id uuid; i integer;
 day date := (now() at time zone 'Asia/Colombo')::date;
 states public.task_status[] := array['backlog','planned','in_progress','blocked','completed','cancelled']::public.task_status[];
begin
 select id into strict administrator from public.profiles where email='nayanajithdev@gmail.com' and role='super_admin' and status='active';
 if exists(select 1 from public.teams where id=t or name='[TEST] Sandbox') then raise exception 'Test sandbox already exists; clean it before seeding again'; end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 insert into public.teams(id,name) values(t,'[TEST] Sandbox');
 for i in 1..2 loop
 insert into public.projects(id,name) values(('5c0a0000-0000-4000-8000-'||lpad((i+1)::text,12,'0'))::uuid,'[TEST] Project '||i) returning id into p;
 insert into public.modules(project_id,name) values(p,'[TEST] Application') returning id into m;
 insert into public.project_memberships(project_id,team_id) values(p,t);
 for j in 1..12 loop
 insert into public.tasks(title,description,team_id,project_id,module_id,assignee_id,assigned_by,status,priority,target_date,start_date,completed_at,blocker,created_at)
 values('[TEST] '||(array['Login validation','Dashboard filters','Task editor','Export review','Calendar layout','Access checks','Search results','Mobile navigation','Standup summary','Profile settings','Report totals','Error handling'])[j]||' / '||i,
 'Synthetic test data. Safe to edit; removed by the sandbox cleanup script.',t,p,m,administrator,administrator,states[1+((j-1)%6)],(array['low','medium','high','urgent'])[1+((j-1)%4)],day+j-7,day-5,
 case when j%6=5 then now()-interval '1 day' end,case when j%6=4 then '[TEST] Waiting for review' else '' end,now()-make_interval(days=>j)) returning id into task_id;
 insert into public.task_comments(task_id,author_id,body) values(task_id,administrator,'[TEST] Check editing, filtering, and status changes.');
 end loop;
 end loop;
 for i in 0..2 loop
 insert into public.standup_sessions(team_id,meeting_date,period,state,notes,created_by)
 values(t,day-i,'morning','draft','[TEST] Practice standup',administrator) returning id into session_id;
 insert into public.standup_assignments(session_id,task_id,developer_id)
 select session_id,id,administrator from public.tasks where team_id=t and status in ('planned','in_progress');
 end loop;
end $$;
commit;
