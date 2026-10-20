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

Deploy `dist` to Vercel with build command `npm run build`. vercel.json supplies SPA route rewrites and basic security headers. Configure the exact final origin in Supabase Site URL/allowed callbacks. For Netlify, add a `/* /index.html 200` SPA rewrite. Use HTTPS and set the same browser environment variables at build time.

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
