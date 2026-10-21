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

## Login Hairline refinement

The login uses the user-selected task-card tray from Hairline, lazy-loaded into a refreshed Blissora-green left panel. A bounded intro plus Pause/Replay, pointer and arrow-key interaction, and live reduced-motion support accompany a simplified borderless Google sign-in region. Authentication behavior is unchanged.

- Login refinement: removed illustration captions/playback controls and reused Hairline task cards on the right sign-in panel, with a four-second intro and reduced-motion support.

- Replaced the duplicate right login figure with the custom Orbit desk platter at the bottom of the sign-in panel; preserved reduced motion, keyboard interaction and the existing left task-card figure.

- Replaced the right login platter with a custom Hairline robot companion: pointer-following head/eyes, an opening nod, and accessible reduced-motion/keyboard behavior.
- Organized the login form and robot into one compact stack, tightened mobile spacing, and simplified sign-in/approval copy. Suggested Hairline Relay as a matching animation alternative.
- Added the approved Hairline Relay below login, replacing the robot. Reused the shared illustration component, retained compact spacing and reduced motion, added keyboard path selection, and removed unused custom illustration runtime code.
- Organized admin Team overview with searchable/filterable developer workload, expandable task lists, blocked-first sorting, compact team summaries and a real blockers queue. Removed the duplicate task feed and verified mobile/dark-theme accessibility.
- Connected the logged-in user’s Google profile photo to the sidebar and My profile, with HTTPS/no-referrer image loading and initials fallback for missing or broken photos.
- Added 25-row report pagination with result ranges, page totals, boundary controls and filter resets; preserved full-data metrics, CSV/XLSX exports and summaries. Verified pagination and export/snapshot browser workflows.
- Reorganized Teams with team/member search, archived filtering, counts and project tags. All dropdowns now use searchable React Select with RHF/modal/keyboard compatibility. Google photos synchronize into authorized profiles and render throughout the app; migration applied, separate migration-history recording blocked by automatic review. Multi-developer/multi-project authorization regression passes.

- Fixed upcoming-day carry-forward: calendar permits future dates/months and projects unfinished tasks, with clear planning labels and workday counts capped at today. Build/lint, 12 unit tests and three browser regressions passed.

- Task cards use a compact top-right dedicated status picker with descriptions, semantic colors and current-choice checkmark. Preserved task update validation, concurrency checks, drag handles and discussion. Build/lint and four affected browser workflows passed across runs.

- Added native Supabase full-text/trigram search, cmdk quick search and server-side task register pagination (default 10; selectable 10/25/50/100). Search migration applied and authenticated read-only smoke check passed. Build/lint, 61 tests and targeted browser workflows passed; frontend not deployed.
