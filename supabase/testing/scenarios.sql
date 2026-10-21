-- Synthetic task history for manual testing. Removed by cleanup.sql.
begin;
do $$
declare
 administrator uuid;
 tids uuid[] := array['5c0b0000-0000-4000-8000-000000000001','5c0b0000-0000-4000-8000-000000000002']::uuid[];
 pids uuid[] := array['5c0b0000-0000-4000-8000-000000000011','5c0b0000-0000-4000-8000-000000000012']::uuid[];
 people text[] := array['Maya Fernando','Arun Perera','Nila Silva','Ravi Jayasinghe','Sara Wijesinghe','Dev Anand'];
 jobs text[] := array['Frontend Developer','Backend Developer','QA Engineer','DevOps Engineer','Full-stack Developer','Reporting Developer'];
 areas text[] := array['Frontend','API','Quality','Delivery','Search','Reporting'];
 developer uuid; module uuid; seed_task uuid; session_id uuid; spec record; i integer; team_index integer; j integer;
 day date := (now() at time zone 'Asia/Colombo')::date;
 week_start timestamptz := date_trunc('week',now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo';
 created timestamptz; started timestamptz; finished timestamptz; final_status public.task_status;
 meeting_day date; period text;
begin
 select id into strict administrator from public.profiles where email='nayanajithdev@gmail.com' and role='super_admin' and status='active';
 if exists(select 1 from public.teams where id=any(tids) or name in ('[TEST] Product Engineering','[TEST] Platform Engineering'))
 or exists(select 1 from auth.users where raw_app_meta_data->>'syncora_test_batch'='task-history-v1') then
 raise exception 'Task-history test dataset already exists; do not seed it twice'; end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 insert into public.teams(id,name) values(tids[1],'[TEST] Product Engineering'),(tids[2],'[TEST] Platform Engineering');
 insert into public.projects(id,name) values(pids[1],'[TEST] Client Portal'),(pids[2],'[TEST] Delivery Platform');
 insert into public.project_memberships(project_id,team_id) values(pids[1],tids[1]),(pids[2],tids[2]);
 for i in 1..6 loop
 developer := ('5c0b0000-0000-4000-8000-'||lpad((100+i)::text,12,'0'))::uuid;
 team_index := case when i<=3 then 1 else 2 end;
 insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data,banned_until,created_at,updated_at)
 values(developer,'syncora-history-'||i||'@example.invalid','authenticated','authenticated',jsonb_build_object('full_name','[TEST] '||people[i]),jsonb_build_object('syncora_test_batch','task-history-v1'),'infinity',now()-interval '28 days',now());
 update public.profiles set status='active',job_title=jobs[i],created_at=now()-interval '28 days' where id=developer;
 insert into public.team_memberships(team_id,developer_id,starts_on) values(tids[team_index],developer,day-28);
 insert into public.modules(project_id,name) values(pids[team_index],'[TEST] '||areas[i]) returning id into module;
 for spec in select * from (values
 (1,1,'Add keyboard shortcuts to the task board','Tab order and shortcuts work without interfering with text input.'),
 (1,2,'Improve mobile navigation and focus handling','Menu closes after navigation and returns focus to the menu button.'),
 (1,3,'Fix date picker layout on small screens','Verify the native date control on iOS and Android; waiting for device screenshots.'),
 (1,4,'Prevent duplicate form submissions','Disable repeated saves while a request is pending and keep error feedback visible.'),
 (1,5,'Add inline validation to sign-in forms','Invalid input explains what to fix without clearing entered values.'),
 (1,6,'Build accessible task status badges','Statuses have readable text and sufficient contrast in both themes.'),
 (2,1,'Add cursor pagination to the activity API','Page boundaries contain no duplicate records and ordering is stable.'),
 (2,2,'Prevent stale task updates from overwriting changes','Reject outdated revisions and return a message that asks the user to refresh.'),
 (2,3,'Investigate intermittent authentication timeouts','Collect request timings; waiting for a reproducible provider trace.'),
 (2,4,'Validate project and team access on task creation','Reject cross-team projects and assignment to inactive users.'),
 (2,5,'Add structured errors to task commands','Use consistent error codes and retain database transaction rollback.'),
 (2,6,'Index task history queries','History stays ordered by event time and supports the task-detail query.'),
 (3,1,'Write regression tests for weekly Done filtering','Cover Monday midnight, Sunday evening and Sri Lanka time boundaries.'),
 (3,2,'Test drag-and-drop with keyboard and pointer input','Verify save, cancellation and stale-update recovery.'),
 (3,3,'Verify screen-reader announcements on Safari','Check pickup and drop messages; waiting for a macOS test device.'),
 (3,4,'Verify account approval and team permissions','Pending users cannot enter the workspace and developers cannot manage other teams.'),
 (3,5,'Test CSV formula-injection protection','Spreadsheet-like values export as text without executing formulas.'),
 (3,6,'Complete mobile layout regression checks','Visit navigation, forms and dialogs at phone and tablet widths.'),
 (4,1,'Document rollback steps for database releases','Include migration review, backup checks and a tested recovery procedure.'),
 (4,2,'Add build and lint checks to release pipelines','A release fails clearly when type checking or lint fails.'),
 (4,3,'Configure preview deployment environment variables','Verify callback URLs; waiting for the preview domain to be approved.'),
 (4,4,'Add health checks to the deployment checklist','Verify frontend availability and database connectivity after deployment.'),
 (4,5,'Separate production and preview secrets','Browser builds include only public Supabase configuration.'),
 (4,6,'Document local developer setup','A clean checkout can install dependencies and start the app using the setup guide.'),
 (5,1,'Add project filters to task search','Changing the project preserves the search text and resets pagination.'),
 (5,2,'Improve task comment threading and empty states','Comments preserve line breaks and clearly identify their author.'),
 (5,3,'Resolve search results with archived project names','Keep historical labels intact; waiting for the archive naming policy.'),
 (5,4,'Add task detail links to notifications','Blocked-work notifications open the relevant task view.'),
 (5,5,'Improve long task-title wrapping','Long titles remain readable without horizontal page overflow.'),
 (5,6,'Add loading feedback to project selection','The form distinguishes a loading list from an empty project list.'),
 (6,1,'Add completion trends to the team report','Group completed tasks by completion date rather than creation date.'),
 (6,2,'Validate report totals against task history','Avoid counting a task twice when it is reopened and completed again.'),
 (6,3,'Reconcile time-zone boundaries in exported reports','Compare application and spreadsheet dates; waiting for a sample export review.'),
 (6,4,'Add developer and team labels to exports','Reports identify the task owner and originating team.'),
 (6,5,'Make CSV and Excel column order consistent','Export headers and values use the same deterministic ordering.'),
 (6,6,'Document report filter definitions','Explain which dates and statuses each report includes.')
 ) as specifications(person,position,title,acceptance) where person=i loop
 j:=spec.position;
 final_status:=case j when 1 then 'planned'::public.task_status when 2 then 'in_progress'::public.task_status when 3 then 'blocked'::public.task_status else 'completed'::public.task_status end;
 finished:=case j when 4 then greatest(week_start,now()-interval '30 minutes') when 5 then week_start-interval '2 days' when 6 then week_start-interval '9 days' else null end;
 created:=coalesce(finished-interval '4 days',now()-make_interval(days=>j+2));
 started:=created+interval '1 day';
 insert into public.tasks(title,description,team_id,project_id,module_id,priority,status,assignee_id,assigned_by,target_date,start_date,completed_at,blocker,blocker_owner,created_at)
 values('[TEST] '||spec.title,'Synthetic test scenario. Acceptance: '||spec.acceptance,tids[team_index],pids[team_index],module,case when j=3 then 'high' else 'medium' end,final_status,developer,developer,day+2,case when j<>1 then (started at time zone 'Asia/Colombo')::date end,finished,case when j=3 then '[TEST] '||spec.acceptance else '' end,case when j=3 then developer else null end,created) returning id into seed_task;
 -- Replace the generated current-time event with an explicitly synthetic timeline.
 delete from public.task_status_history h where h.task_id=seed_task;
 insert into public.task_status_history(task_id,new_status,assignee_id,actor_id,detail,created_at)
 values(seed_task,'planned',developer,developer,'{"synthetic":true,"seed_batch":"task-history-v1"}',created);
 if j<>1 then
 insert into public.task_status_history(task_id,old_status,new_status,assignee_id,actor_id,detail,created_at)
 values(seed_task,'planned','in_progress',developer,developer,'{"synthetic":true,"seed_batch":"task-history-v1"}',started);
 end if;
 if j>=3 then
 insert into public.task_status_history(task_id,old_status,new_status,assignee_id,actor_id,detail,created_at)
 values(seed_task,'in_progress',final_status,developer,developer,jsonb_build_object('synthetic',true,'seed_batch','task-history-v1','blocker',case when j=3 then spec.acceptance else '' end),coalesce(finished,now()-interval '1 day'));
 end if;
 insert into public.task_comments(task_id,author_id,body,created_at) values
 (seed_task,developer,'[TEST] Acceptance criteria: '||spec.acceptance,created+interval '1 hour'),
 (seed_task,developer,case when j=3 then '[TEST] Raised this blocker for the next standup: '||spec.acceptance when j>=4 then '[TEST] Implementation and acceptance checks completed. Ready for the meeting review.' else '[TEST] Next step: verify the implementation against the acceptance criteria.' end,coalesce(finished,now()-interval '1 hour'));
 end loop;
 end loop;
 for meeting_day in select d::date from generate_series(day-20,day,interval '1 day') d where extract(isodow from d) between 1 and 5 loop
 for team_index in 1..2 loop
 foreach period in array array['morning','evening'] loop
 insert into public.standup_sessions(team_id,meeting_date,period,state,notes,created_by,created_at)
 values(tids[team_index],meeting_day,period,case when meeting_day=day then 'draft' else 'confirmed' end,'[TEST] Synthetic meeting: review active task progress, confirm acceptance checks, and follow up on the recorded blockers.',administrator,(meeting_day+case when period='morning' then time '09:00' else time '17:00' end) at time zone 'Asia/Colombo') returning id into session_id;
 insert into public.standup_assignments(session_id,task_id,developer_id)
 select session_id,t.id,t.assignee_id from public.tasks t where t.team_id=tids[team_index] and (t.created_at at time zone 'Asia/Colombo')::date<=meeting_day and (t.completed_at is null or (t.completed_at at time zone 'Asia/Colombo')::date>=meeting_day);
 end loop;
 end loop;
 end loop;
end $$;
commit;
