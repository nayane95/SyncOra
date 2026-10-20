# Architecture

The browser runs React, React Router, TanStack Query, React Hook Form/Zod, Tailwind, shadcn-style Button/Dialog components with Radix, Lucide icons, date-fns, Recharts, and a dynamically imported ExcelJS exporter.

Supabase Auth owns identity. A database trigger creates each profile with `pending` status and `developer` role. The trigger ignores user metadata role claims. The deployment operator explicitly bootstraps the first Super Admin.

PostgreSQL is authoritative. Every application table has RLS. Authenticated clients have SELECT grants and permission to call the transactional `command(action,payload)` function; they have no direct INSERT, UPDATE, or DELETE grants. The function validates the current profile, scope, ownership, state transitions, dates, membership, and optimistic concurrency tokens before writing. Multi-record operations roll back together. Audit and task history triggers run on the server.

Team memberships have inclusive start dates and exclusive end dates. Work records store the team for their work date; changing a current membership does not rewrite those records. Report task snapshots capture status, title, project, and module when a draft/submission is saved. Reports use those snapshots rather than pretending today's task status was its historical status.

Tasks remain one row across days. Morning carry-forward selects currently incomplete, previously created work. Working-day calculations skip configured weekends and holidays; completed and cancelled tasks are excluded. Morning confirmation stores dated task/developer assignments. Evening review loads that morning plan plus current work. Contributors share task visibility and may include the task in their own daily record; each person's daily hours remain independent.

The browser exporter reads only RLS-authorized records, sorts by date, and exports one row per approved developer/day. XLSX metadata and detail sheets preserve the reporting period, task breakdown, and generated time. CSV escapes formula-like values and cannot preserve workbook styling or multiple sheets.

Privileged Google credentials exist only in Edge Function secrets. Manual sync requires an active Super Admin verified against Supabase Auth and the database. Scheduled sync requires a separate high-entropy secret. Sync reads approved work logs, builds five reporting tabs, then applies one atomic Google Sheets batch reconciliation. Retrying replaces source-keyed rows instead of appending duplicates. Private leave reasons and emails are excluded from Sheets.

Realtime subscribes to tasks, daily work logs, leave requests, standup sessions, and the signed-in user's profile. RLS filters changes. Each subscription is removed on unmount. Table-specific query invalidation follows mutations.

Historical tables are paginated. Operational rosters and filtered date-range reports fetch pages as needed to avoid silent 1000-row truncation. Exports currently assemble workbooks in browser memory, appropriate for the initial small team; move large historical export jobs to durable background processing when workbook size or Edge Function runtime becomes a constraint.
