# SyncOra

React/Vite and Supabase workspace for daily planning, tasks, work updates, leave, and reporting.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

With no environment values the app opens an honest setup screen. It does not bypass authentication or load fake production records. Configure Supabase using [deployment instructions](docs/deployment.md), then restart Vite.

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The optional Edge Function mock suite uses Deno without live credentials:

```sh
npm exec --yes --package=deno -- deno test --allow-env supabase/functions/_shared/sheets.test.ts
```

Playwright starts its own server on port 5174 with explicit test-only API fixtures, separate from the app on port 5173. Database tests execute all four real migration files in embedded PostgreSQL with Supabase's auth schema replaced by a minimal test fixture; they test actual RLS and SQL commands, not mocked permissions.

## What is included

- Google OAuth with PKCE, pending approval, active-account guards, and server-controlled roles.
- Team membership history, lead scope, projects, modules, and team/project access.
- Stable task IDs, status history, comments, contributors, bulk assignment/status changes, and conflict detection.
- Morning plans and evening review, draft/confirmed meetings, automatic carry-forward without cloning tasks.
- Developer Overview shows today’s To do / In progress / Done board. My tasks uses React Big Calendar; selecting a day opens its historical tasks in a bottom sheet. Unfinished tasks carry forward automatically; completed tasks appear on their completion day. Creation dates and configured workdays spent In progress are derived from saved task/status history (excluding weekends/holidays, without manual hours). Admins review work by developer and team in standups. Daily notes, daily-note history pages and submission/review controls are retired. Old links redirect to My tasks. Task comments and shared meeting notes remain; historical daily records are retained in the report archive without new-entry or review controls.
- Leave requests and decisions, overlap exclusion constraint, working calendar, holidays, and attendance defaults.
- Authorized analytics, deterministic WhatsApp summaries, immutable report snapshots, XLSX and safe CSV exports.
- Optional server-side Google Sheets synchronization, retries, reconciliation, sync history, and scheduling endpoint.
- Selective Realtime subscriptions with cleanup, paginated history, scoped data reads, and audit records.

## Setup and operation

- [Architecture](docs/architecture.md)
- [Database and business rules](docs/database.md)
- [Permission model](docs/permissions.md)
- [Deployment and secure administrator bootstrap](docs/deployment.md)
- [Google OAuth](docs/google-oauth-setup.md)
- [Google Sheets and scheduling](docs/google-sheets-setup.md)
- [User guide](docs/user-guide.md)
- [Verification and external checks](docs/verification.md)
- [Progress checklist](PROGRESS.md)

No credentials are included. Remote OAuth, Supabase Realtime, deployed Edge Functions, and Google Sheets need live validation in your configured environment before release. Local tests do not establish that those services are configured correctly.

### UI development

Read [DESIGN.md](DESIGN.md) before changing screens. It defines the Blissora palette, shadcn primitives, task cards/sheets, theme tokens, form validation and mobile/accessibility checks. Repository instructions in [AGENTS.md](AGENTS.md) make this the default for future work. Shared components live in `src/components/ui`; the `@/` alias is configured for new shadcn components.
