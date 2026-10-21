-- Deletes all work in the three reserved [TEST] teams, including edits made while testing.
-- Deletes only the six marked, permanently banned dummy accounts; real accounts are preserved.
begin;
do $$
declare
 tids uuid[] := array['5c0a0000-0000-4000-8000-000000000001','5c0b0000-0000-4000-8000-000000000001','5c0b0000-0000-4000-8000-000000000002']::uuid[];
 pids uuid[] := array['5c0a0000-0000-4000-8000-000000000002','5c0a0000-0000-4000-8000-000000000003','5c0b0000-0000-4000-8000-000000000011','5c0b0000-0000-4000-8000-000000000012']::uuid[];
 uids uuid[] := array['5c0b0000-0000-4000-8000-000000000101','5c0b0000-0000-4000-8000-000000000102','5c0b0000-0000-4000-8000-000000000103','5c0b0000-0000-4000-8000-000000000104','5c0b0000-0000-4000-8000-000000000105','5c0b0000-0000-4000-8000-000000000106']::uuid[];
begin
 if exists(select 1 from public.teams where id=any(tids) and not (
 (id=tids[1] and name='[TEST] Sandbox') or (id=tids[2] and name='[TEST] Product Engineering') or (id=tids[3] and name='[TEST] Platform Engineering'))) then
 raise exception 'Test team identity changed; inspect before deleting'; end if;
 if exists(select 1 from auth.users where id=any(uids) and (
 raw_app_meta_data->>'syncora_test_batch' is distinct from 'task-history-v1'
 or banned_until is distinct from 'infinity'::timestamptz
 or email not like 'syncora-history-%@example.invalid')) then
 raise exception 'Dummy account identity changed; cleanup cancelled'; end if;
 if exists(select 1 from public.tasks where project_id=any(pids) and not(team_id=any(tids)))
 or exists(select 1 from public.project_memberships where project_id=any(pids) and not(team_id=any(tids))) then
 raise exception 'Test projects are used by another team; cleanup cancelled'; end if;
 delete from public.daily_task_updates where work_log_id in(select id from public.daily_work_logs where team_id=any(tids)) or task_id in(select id from public.tasks where team_id=any(tids));
 delete from public.standup_assignments where session_id in(select id from public.standup_sessions where team_id=any(tids)) or task_id in(select id from public.tasks where team_id=any(tids));
 delete from public.task_comments where task_id in(select id from public.tasks where team_id=any(tids));
 delete from public.task_status_history where task_id in(select id from public.tasks where team_id=any(tids));
 delete from public.task_assignees where task_id in(select id from public.tasks where team_id=any(tids));
 delete from public.tasks where team_id=any(tids);
 delete from public.daily_work_logs where team_id=any(tids);
 delete from public.leave_requests where team_id=any(tids);
 delete from public.report_snapshots where team_id=any(tids);
 delete from public.standup_sessions where team_id=any(tids);
 delete from public.team_memberships where team_id=any(tids);
 delete from public.project_memberships where team_id=any(tids);
 delete from public.modules where project_id=any(pids);
 delete from public.projects where id=any(pids);
 delete from public.teams where id=any(tids);
 -- Retain audit evidence while releasing only references to the removed dummy identities.
 update public.audit_logs set detail=detail||jsonb_build_object('removed_test_actor',actor_id),actor_id=null where actor_id=any(uids);
 delete from public.profiles where id=any(uids);
 delete from auth.users where id=any(uids);
end $$;
commit;
