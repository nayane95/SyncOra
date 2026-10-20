# Database

Apply the migrations in lexical order. Do not create tables manually. `src/types/database.ts` describes the deployed public contract. After schema changes, regenerate using `supabase gen types typescript --linked` and reconcile the row types.

The schema contains 23 application tables: profiles, teams, team_memberships, projects, modules, project_memberships, tasks, task_assignees, task_status_history, task_comments, standup_sessions, standup_assignments, daily_work_logs, daily_task_updates, leave_types, leave_requests, holidays, working_calendar_settings, report_snapshots, report_exports, google_sheet_integrations, sync_jobs, and audit_logs.

UUIDs identify records. Tasks also receive a human-readable identity number. Tasks have stable IDs and statuses backlog/planned/in_progress/blocked/completed/cancelled. Carry-forward is a computed planning classification, never a status or cloned task.

Daily work records are unique on `(developer_id,work_date)`. Hours are a numeric daily total in the range 0..24, never repeated per task. Approved leave/absence has zero worked hours. Half-day expected hours are four; full working days eight; weekends and holidays zero, with explicit recorded work allowed. Public holidays and working days are checked before leave attendance, so nonworking dates do not become productive leave hours.

Submissions follow draft -> submitted -> approved or revision_requested -> submitted. A reviewer cannot approve their own record. Submitted/approved rows are locked; an authorized different reviewer may reopen approved work for revision with a reason. The original recorder, reviewer, timestamps, and command audit remain recorded. Corrections to an already exported record require a new export or sync.

Leave uses date ranges without UTC conversion. Approved ranges have a PostgreSQL exclusion constraint preventing overlap, including half days (two half days on the same date cannot overlap). Half-day requests span one date only. Pending leave does not affect expected attendance. Approval/cancellation cannot silently alter already submitted/approved work records: reopen those first. Leave never completes or reassigns tasks.

The membership exclusion constraint prevents overlapping active team memberships. End dates are exclusive, so a move may close the old team and open the new one on the same date. Existing daily records retain their saved team. Same-day membership corrections after a work record exists are rejected to protect reporting attribution; schedule the change for the next date using an operator-reviewed SQL transaction if necessary.

All mutable privileged commands validate scope inside SECURITY DEFINER functions with a fixed search_path. Direct table writes by browser roles are revoked. Internal trigger functions cannot be invoked by authenticated users. No public registrant becomes an administrator automatically.

Task edits, meeting plans, and draft work edits require `expected_updated_at`; stale writes fail rather than overwrite another change. Task snapshot selections are reconciled transactionally. Same-day edits refresh their task statuses; revising an older record retains the previously captured task status/title/context. Status history is append-only to clients.

For optional demonstration configuration run `supabase/seed.sql` manually in a development project. It creates only configurable teams, projects and modules. `supabase/demo-data.sql` defines an explicit development-only seed procedure for eight already authenticated users supplied by UUID. It creates no auth identities and no credentials. Never run either seed in production.
