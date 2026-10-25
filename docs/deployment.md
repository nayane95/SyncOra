# Deployment

## Supabase

Create a project. Install the Supabase CLI using its official instructions, then:

Fill `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` in the ignored `.env` file for local deployment configuration. The password is deployment-only and must never use a `VITE_` prefix. Saving these values does not run migrations or automatically export them to the CLI: load them into your deployment process environment, or enter the password when prompted. See the [Supabase CLI environment variable documentation](https://supabase.com/docs/reference/cli/v1/supabase-db-push).

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For a local backend with Docker, use `supabase start` and `supabase db reset`. Seeding is disabled in config.toml. Migrations include the auth trigger, tables, grants, RLS, commands, constraints, and selected Realtime publication tables.

If sign-in reports `Could not find the table 'public.profiles' in the schema cache`, verify that the migrations have been applied to the same project as `VITE_SUPABASE_URL`. Deploy the migration files in order using `supabase db push`. The third migration creates missing profiles for accounts that authenticated before schema deployment, leaves existing profiles untouched, defaults new profiles to pending/developer, and requests a PostgREST schema-cache reload. It does not approve accounts or grant administrator access. Refresh the application after successful deployment; existing users should then reach Pending Approval. Bootstrap the intended first administrator separately using the explicit procedure below.

Enable Google following google-oauth-setup.md. In Authentication URL Configuration allow only your own exact local and production callback URLs. New users appear as pending profiles.

## First administrator: explicit deployment operation

Sign in once with the intended operator's real Google account. From the trusted Supabase SQL editor, verify its identity and run this transaction, replacing the email:

```sql
begin;
select id,email,role,status from public.profiles where email='YOUR_VERIFIED_WORK_EMAIL';
update public.profiles set role='super_admin',status='active'
where id=(select id from auth.users where email='YOUR_VERIFIED_WORK_EMAIL')
  and email='YOUR_VERIFIED_WORK_EMAIL';
commit;
```

Confirm exactly one intended profile changed. Refresh the application, approve other accounts, assign roles, create teams, add memberships, grant team/project access, then run a standup. Do not expose an automatic bootstrap endpoint. The application prevents demoting the final active Super Admin.

## Frontend

The fourth migration, `202610200004_developer_workflow.sql`, allows active developers to create self-owned tasks in their current team without marking them as unplanned. Cross-team creation and assignment to other people remain blocked. It also derives work-log attendance and hours from the calendar and approved leave, ignoring manually supplied hours. Existing records are not rewritten. Assign approved developers to a team before asking them to create work; they do not need admin-created tasks or daily notes to use the task board.

Set browser-safe values in `.env.local` (local) or deployment environment settings:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Legacy anon keys are accepted via `VITE_SUPABASE_ANON_KEY`, but prefer the project's publishable key. These are the only Supabase values required by the frontend. Never paste a secret/service-role key here.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Deploy `dist` to Vercel with build command `npm run build`. vercel.json supplies SPA route rewrites and basic security headers. Configure the exact final origin in Supabase Site URL/allowed callbacks. For Netlify, `netlify.toml` sets `npm run build` and the `dist` publish directory. `public/_redirects` is copied into `dist/_redirects` by Vite and rewrites application routes to `/index.html` with status 200, so direct links, refreshes and `/auth/callback` reach React Router. Existing static files are served normally. After changing this configuration, trigger a new Netlify deploy; for manual uploads, upload the complete `dist` folder including `_redirects`. Use HTTPS and set the same browser environment variables at build time.

## Edge Functions

The Supabase runtime supplies SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY automatically. Add APP_ORIGIN for production CORS. The optional Google setup adds three further secrets listed in google-sheets-setup.md.

```sh
supabase secrets set APP_ORIGIN=https://YOUR_FRONTEND_ORIGIN
supabase functions deploy admin-users
supabase functions deploy report-export
supabase functions deploy google-sheets-sync
supabase functions deploy scheduled-sync
```

The function configuration disables gateway JWT verification because handlers explicitly validate bearer tokens with Auth and enforce current profiles, supporting publishable-key projects. Do not remove those handler checks. Scheduled sync uses its own secret and never accepts an unauthenticated request without it.

## Release verification

Use real accounts for developer, lead, and Super Admin. Verify all acceptance scenarios in the supplied brief against the deployed project. Run one real OAuth sign-in, approval, team-scoped access attempt, morning assignment, developer update, different-reviewer approval, leave approval, XLSX inspection, and optional Sheets sync twice with a correction between runs. Confirm RLS by trying unauthorized REST writes. Verify Realtime updates in separate browsers. Review Supabase logs, backups/PITR availability, account-recovery procedures, and retention appropriate to your organization.

The local automated suites do not replace this live release check. No remote infrastructure has been created by the code in this repository.

The fifth migration, `202610200005_task_based_memberships.sql`, removes the retired daily-record guard from same-day membership changes. Changes close the previous dated membership and create the new membership as before; tasks and daily records retain their stored team IDs. Apply with the other migrations. No frontend deployment is required for this database-only fix.


### Google profile photos

`202610210001_google_profile_photos.sql` adds the authorized `profiles.avatar_url` field, backfills existing Google photos, and synchronizes it when auth metadata changes. It leaves profile-read policies and account approval intact. New accounts still require approval. The frontend uses this URL throughout member/task avatars with initials for missing or failed photos. This migration was applied to the configured project on 21 October 2026.

## Native task search

`202610210002_task_search.sql` enables pg_trgm, adds full-text/trigram indexes and the security-invoker `search_tasks` RPC. Apply this migration before deploying the task-register frontend; no Algolia service or environment variables are required. Search and exact pagination counts retain existing task RLS. The RPC accepts only supported filters, 200-character queries, nonnegative pages and limits 10/25/50/100. Indexes update automatically when tasks change.

Applied to the configured Supabase project on 21 October 2026 using verified TLS. An authenticated read-only smoke check returned 10 rows out of 62 authorized tasks; anonymous RPC execution is denied. This application used the migration SQL directly; it did not change the separate migration-history table.

## Realtime conversations

`202610250001_realtime_conversations.sql` adds task comments, task status history, contributors, standup assignments and daily task updates to the existing realtime publication. It is safe to rerun and preserves RLS. The workspace subscribes to these tables alongside tasks, standup sessions/notes, daily work logs and leave requests. Incoming events invalidate matching authorized queries; subscribing/reconnecting refreshes them to recover missed changes. Sign-out/user changes remove the previous subscription.

Applied and verified on the configured Supabase project on 25 October 2026 using certificate-verified TLS. No row data or migration-history bookkeeping changed. Deploy the frontend to enable the new subscriptions. Verify with two authorized browsers: post a comment in one and observe it in the other; disconnect/reconnect the reader and check missed comments appear.

## Seeded Super Admin and email sign-in

The login page supports existing Supabase email/password accounts alongside Google; all sessions retain the same active-profile/role checks. Enable the Email provider in hosted Supabase Authentication if using password accounts there. There is no public signup or automatic role elevation.

For a local Supabase instance with migrations applied, run `npm run seed:admin` with `SUPABASE_SERVICE_ROLE_KEY` (local service-role key) and `SEED_ADMIN_PASSWORD` (at least 16 characters) supplied through your shell's secret environment. `SUPABASE_URL` defaults to `http://127.0.0.1:54321`; remote hosts require the explicit `--production` flag and HTTPS. The email defaults to `super-admin@example.com`, override with `SEED_ADMIN_EMAIL` if needed. Do not put service-role keys in VITE variables or commit credentials. The command creates a confirmed Auth account and activates its profile as Super Admin using the trusted service client. Existing accounts are not overwritten or silently promoted. If profile activation fails, inspect the pending profile; the command reports the partial result rather than deleting accounts. Existing email-domain restrictions still apply.

No default password is shipped. This seed is an explicit setup command, not an automatic migration.

For production, set `SUPABASE_SERVICE_ROLE_KEY` and `SEED_ADMIN_PASSWORD` in the ignored local `.env`, then run `node --env-file=.env scripts/seed-super-admin.mjs --production`. The target is `SUPABASE_URL`, falling back to `VITE_SUPABASE_URL` in production mode; it must be the Supabase project origin, not the Netlify site. The command uses the Admin Auth API, confirms the account and activates only its newly created profile as Super Admin. Duplicate accounts fail rather than overwriting credentials or promoting an existing account. Keep the key/password out of Vite variables and logs, and remove temporary seed secrets from the local environment after setup.

The requested seed email is `super-admin@example.com`. It cannot receive password-recovery mail; use a real controlled address for an administrator that needs email recovery. Hosted Email/password authentication must be enabled. The requested production account was created on 25 October 2026; email/password authentication and its active Super Admin profile were verified.
