# Local verification

Date: 20 October 2026 (Asia/Colombo).

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Strict TypeScript | PASS | `npm run typecheck`, including app, tests and Playwright configuration |
| ESLint | PASS | `npm run lint` |
| Business/component/database tests | PASS | 46 tests across five files with Vitest 5.0.5 |
| Real SQL/RLS execution | PASS | 21 cases execute all four migration files in embedded PostgreSQL; only Supabase Auth infrastructure is a test fixture |
| Browser workflows | PASS | All 18 Playwright scenarios with explicitly mocked Auth/REST/Realtime |
| Accessibility | PASS | Axe WCAG A/AA scan on all 13 admin pages; morning page in light/dark at 1440, 800 and 390px; no horizontal page overflow; 200% text sizing after content loads |
| Edge runtime types | PASS | Deno checks for all four function entrypoints |
| Edge pipeline mocks | PASS | Two Deno tests execute sync token signing, source queries, atomic reconciliation, corrections, failed job recording and current-profile authorization with mocked HTTP |
| Production bundle | PASS | `npm run build`; screen routes and ExcelJS load dynamically |
| Dependency audit | PASS | `npm audit`: zero reported advisories across production and development dependencies |
| Unconfigured startup | PASS | Running app at `http://127.0.0.1:5173/login`: setup heading, desktop Axe scan and 390px overflow check |

The browser scenarios exercise OAuth handoff, pending restrictions, developer route restrictions, task editing/validation, evening review, all admin routes, theme/mobile navigation, morning draft/confirmation, assignment dialogs, membership/project/calendar/profile forms, leave validation, daily hours/submission, CSV/XLSX download, WhatsApp copy/snapshot, empty data and recoverable network errors. Dialog tests check accessible naming, focus and Escape.

## Daily logging and mobile update

### Task-based WhatsApp summary correction

- Hard gate PASS: the active summary reads tasks and task-status history rather than approved daily notes. Past dates reconstruct status and recorded ownership/blockers as of the selected Colombo date. Done includes completion transitions on that date, not subsequent edits to already completed tasks. Missing historical status is labeled rather than invented.
- Purpose gate PASS: the approval badge and approval-only copy were replaced with task-based labeling. Regenerate refreshes source queries, resets manual edits, and respects the selected team/developer/project/module/status filters. Copy and snapshot actions remain disabled while loading or after a source error. The summary is independent of archive export date-range validity.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 2 / MOTION 1 retained. The populated 390px summary screenshot was visually inspected.
- Craft PASS: seven new unit cases cover date boundaries, historical ownership, old completions, metadata-only edits, missing history, cancelled/future work and empty sources. All 46 unit/database tests, build and lint pass. Three report browser workflows pass, including zero daily-note data, copying, snapshots, regeneration and errors; the historical-data flow also passes at phone width. All-route Axe/navigation checks pass. A read-only query against the live seeded dataset generated 24 task lines across two teams for 19 October 2026. Current titles and project/team metadata are used with historical status events. No backend migration was needed; hosted frontend deployment remains outstanding.

### Removable task-history dataset

`supabase/testing/scenarios.sql` was applied to the configured Supabase project on 20 October 2026. Transaction checks verified six permanently banned dummy accounts, 36 tasks, 90 synthetic history events, 72 comments and 60 meetings. Existing profile IDs/roles/statuses were compared before and after; no existing accounts or retired daily-note records were changed. `cleanup.sql` now handles both this dataset and the original sandbox. Embedded PostgreSQL tests verify counts, duplicate rejection, cleanup refusal after a dummy identity is altered, repeatable removal and preservation of real records. All 39 tests and lint pass. Cleanup was tested locally; the live test dataset intentionally remains for the user's testing. Dummy accounts cannot be used for sign-in.

### Daily-note retirement

- Hard gate PASS: daily-note navigation, forms, history views, capture and review controls are removed. The retired routes redirect to My tasks; browser checks verify the redirects and absence of daily-note queries on those routes.
- Purpose gate PASS: standups now group tasks into To do, In progress, Blocked and completed work. Notifications show blocked tasks and leave. Shared meeting decisions and task comments remain. Historical daily records and exports are clearly labeled as the report archive; no database rows are deleted.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 2 / MOTION 1 and responsive patterns retained; the mobile standup screenshot was inspected.
- Craft PASS: all 18 browser scenarios and 38 unit/database tests pass, including archive exports, account access, leave, task creation, DnD, week boundaries, route accessibility and phone/tablet themes. The unused update page, validation schema and form styles were deleted. Legacy database commands, schemas and archive integration support remain for data compatibility; no destructive migration was applied. Hosted frontend deployment and physical phone testing remain outstanding.

### Weekly Done column

- Hard gate PASS: Done includes only `completed` tasks whose `completed_at` falls within the current Monday-to-Sunday week in Asia/Colombo. Cancelled tasks and completions outside the week are excluded. Open tasks remain visible regardless of age. Records are not deleted.
- Purpose gate PASS: the completion window is applied in the API query before pagination so older completions cannot crowd out current work; the column caption states the week scope.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 2 / MOTION 1 and board styling are retained.
- Craft PASS: 38 unit/database tests, build and lint pass. Targeted browser checks cover task creation, pointer/keyboard DnD and week filtering. Week tests include exact Sri Lanka Monday midnight, the instant before it, Sunday end, next Monday exclusion, and the year boundary. No backend migration was needed; the hosted frontend has not been redeployed.

### Package-based task movement

- Hard gate PASS: `@dnd-kit/react` 0.5.1 replaces native HTML dragging. Pointer and keyboard movement save the task's status and expected revision; Escape cancels; a simulated stale-save rejection preserves its original column. Status menus remain available. The creation/status scenario passes Axe WCAG A/AA.
- Purpose gate PASS: compact search frees space for work; bordered task cards and grip handles identify movable work; active column highlighting and live save feedback expose the action's result. Dashed drop-zone placeholders were removed at the user's request. Existing SyncOra tokens and 44px controls are retained; touch-action is disabled only on the drag handle to preserve normal page scrolling.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 retained; the three work stages establish hierarchy, teal highlights the active destination, and only a short border/background transition is added.
- Craft PASS: the updated desktop screenshot was inspected. Five targeted browser scenarios pass against the package implementation: admin layouts, developer layouts, creation/accessibility, pointer movement and failed saves, keyboard movement and cancellation. Build, lint and all 37 unit/database tests pass. Installation audit reported zero vulnerabilities. No backend change was needed. Physical phone dragging has not been verified; use the status menu if needed on touch devices. The full browser suite was not repeated for this package replacement.

The developer home now opens the task board. A browser scenario creates a self-owned normal task and moves it through In progress and Done without entering hours. Database tests verify self-assignment, admin visibility, cross-team/other-person rejection, automatic eight-hour working days, zero-hour weekends and four-hour half-day leave even when the client supplies conflicting hours. Standup tests confirm assignment controls are absent and meeting notes still save. Admin overview shows current work by developer and team. The 390px task-board screenshot was visually inspected. All 15 browser scenarios, 37 unit/database tests, build and lint pass after this workflow change. Migration four has been applied to the configured Supabase database; no historical records were rewritten.

- Hard gate PASS: daily logging search, selection, optional notes and draft payload pass browser checks; the mobile logging form passes Axe WCAG A/AA. Existing submission and review tests pass; submitted work remains read-only.
- Purpose gate PASS: task selection appears first to connect the daily record to assigned work; optional notes collapse to shorten the form. Shared 16px phone inputs prevent input zoom; full-width actions and wrapping list rows make controls easier to use. Wide tables retain their columns in named, keyboard-scrollable regions.
- Liveliness PASS: existing DESIGN.md direction retained, ENERGY 2 / RHYTHM 2 / MOTION 1; task selection and daily summary form distinct sections, teal marks selection and submission, with no new animation.
- Craft and mobile PASS: all 13 admin screens and seven developer screens fit 360px phones and 768px tablets in both themes. The 360px logging screenshot was visually inspected. Existing desktop, mobile menu, dialog, accessibility and 200% text checks pass. Build, lint, 35 unit/database tests and all 14 browser scenarios pass.

Browser checks use fixtures. Physical iOS/Android keyboards and live deployed authenticated sessions were not tested. Existing bundle size warnings remain.

Database tests cover default pending accounts, untrusted metadata role claims, direct write denial, self-only records, team scope, cross-team assignment rejection, stale edits, immutable approved/submitted records, revision/resubmission, self-review denial, daily uniqueness, stable planning task IDs, leave overlap, zero/four-hour defaults, holiday precedence, deactivation, RLS on all tables, project/module scope, contributors without private-work-log access, comments, bulk rollback, explicitly mapped demo seeding, historical task snapshot preservation, and membership changes without rewriting old reports.

[Desktop screenshot](standup-desktop.png) and [mobile screenshot](standup-mobile.png) contain explicit **test fixtures**, not actual team activity.

## Anti Slop delivery gate

These results describe the locally tested implementation. They do not certify a live deployment.

- R-01 PASS: no gradients or glows; surface hierarchy is documented in DESIGN.md.
- R-02 PASS: product source contains no authored em/en dashes or invented claims; dates and counts come from records.
- R-03 PASS: browser overflow assertions pass at 1440, 800 and 390px, including loaded content at 200% text size.
- R-04 PASS: required Lucide glyphs identify matching actions; rationale is recorded in DESIGN.md.
- R-05 PASS: the roster/work panel, record tables, calendar and report editor follow their distinct workflows rather than a landing-page template.
- R-06 PASS: system sans serves dense daily reading; tabular counts serve comparison; rationale is recorded.
- R-07 PASS: no background grid or dot pattern is used.
- R-08 PASS: arrows occur only in compact task-edit controls and meeting navigation.
- R-09 PASS: badges communicate saved task, submission, attendance or review states.
- R-10 PASS: blur is limited to topbar context and modal overlay elevation.
- R-11 PASS: controls, panels and initial placeholders have distinct 6px/12px/circular radii.
- R-12 PASS: only dialogs receive elevated shadows; panels remain grounded by borders.
- R-13 PASS: no glow effects are used.
- R-14 PASS: work rows, calendar cells, metrics and roster items have different information structures.
- R-15 PASS: controls name concrete actions such as Assign task, Submit update and Export Excel.
- R-16 PASS: no AI marketing claims are used in product copy.
- R-17 PASS: metrics derive from RLS-authorized task, profile and daily work records.
- R-18 PASS: there are no testimonials or fabricated customer identities.
- R-19 PASS: motion is limited to loading; reduced-motion preferences disable animation.
- R-20 PASS: morning/evening planning, the roster and carry-forward groups define the application identity.
- R-21 PASS: light/dark toggles are implemented and scanned for contrast and layout.
- R-22 PASS: there are no stock/generated decorative illustrations.
- R-23 PASS: the wordmark is the requested product name; initials are placeholders; test fixtures are explicitly labeled in tests and documentation.
- R-24 PASS: every navigation entry maps to an implemented, guarded route; all admin routes were visited in Playwright.
- R-25 PASS: Axe scans on every admin route and both morning themes report no WCAG A/AA violations.
- R-26 PASS: controls have real navigation, form, mutation, copy, download or state behavior; the workflow click-through is recorded in e2e/workspace.spec.ts.
- R-27 PASS: data views provide loading, empty and error handling; browser tests assert empty/recoverable-error states.
- R-28 PASS: no generic FAQ exists.
- R-29 PASS: neutral/teal palette with blue/amber/red used only for semantic status; DESIGN.md records this purpose.
- R-30 PASS: layout follows the supplied standup workflow and contains no copied product layout or assets.
- R-31 PASS: typography, layout, palette, radius, icon and elevation reasons are recorded in DESIGN.md.
- R-32 PASS: native controls and Radix dialogs provide keyboard interaction, visible focus, focus trapping and Escape dismissal; these are tested.
- R-33 PASS: UI changes were authored in source; no source-rewriting patch scripts were used.
- R-34 PASS: both themes pass the morning-page Axe scan at desktop, tablet and mobile widths.
- R-35 PASS: production build, automated workflow click-through, full-route accessibility scan and inspected screenshots were completed locally.
- R-36 PASS: no compliance, security certification, customer or performance guarantees are claimed.
- R-37 PASS: supplied visual direction was declared before generation and saved to DESIGN.md; ENERGY 2 / RHYTHM 2 / MOTION 1.
- R-38 PASS: production starts empty; development seeds require explicit real-user mapping; browser identities/work are named test fixtures.
- Liveliness PASS: dials match the restrained meeting workspace; active-member accent is the focal point, spacing separates planning groups, and morning/evening labels repeat the identity motif.
- C-1 PASS: design choices have recorded workflow/readability reasons in DESIGN.md.
- C-2 PASS: implemented controls have handlers and tested workflow paths; no coming-soon controls appear.
- C-3 PASS: each page serves a requested task, approval, meeting, calendar or reporting workflow.
- C-4 PASS: native controls, responsive reflow, focus styles, loading/error states and Radix modal handling were locally verified.
- C-5 PASS: no unsupported claims, testimonials or production activity were invented.

## Limits and release checks

All four migrations were applied to the configured Supabase project on 20 October 2026. The live REST endpoint recognizes `profiles` and rejects unauthenticated reads with permission denied rather than a missing-table error. Authenticated browser sign-in, email delivery/provider settings, full deployed RLS behavior, cross-browser Realtime, deployed Edge secrets, actual Sheets writes and a live scheduler still require the release procedure in deployment.md. CI configuration was authored but has not been verified on the remote GitHub repository.

The export workbook and full Sheets reconciliation are held in memory, suited to the initial small team. Large histories may need durable export/sync jobs. Vite reports large shared/ExcelJS chunks; ExcelJS is loaded only when exporting and chart screens are separate chunks. npm dependency auditing cannot certify the absence of all vulnerabilities, including code prebundled by upstream packages; the app generates workbooks and does not accept untrusted XLSX uploads.

Local screenshots and mocks are proof of those tested UI states, not proof of real production data or service connectivity.

## Task reports replace daily-record reporting

The Reports page now reads authorized tasks and status history. Metrics count tasks, in-progress work, completions in the selected period and blockers. The table and CSV/Excel exports use the same rows. Open work is reconstructed as of the end date; completions before the start date and cancelled tasks are excluded. Missing history is explicitly labelled. Team/project/module metadata and task titles retain their current values because status events do not store historical versions of those fields. Daily records and their legacy export helpers remain preserved but are not queried by this screen.

Hard: build and lint pass; shared historical-status unit tests pass. Browser checks cover task reports without daily notes, download formats, historical status/date boundaries, filters, summaries and history failures.
Purpose: developer task progress populates reporting without requiring retired daily-note approvals or manual hours.
Liveliness: loading/error states disable exports; summaries keep their independent date and edits.
Craft: existing filters/table/metrics reused; mobile table scroll stays contained at 390px.

## Multiple developers across multiple projects

Project access remains many-to-many through teams: each team can access several projects and each project can authorize several teams. All active developers in an authorized team can create independent tasks in those projects. No exclusive developer-to-project assignment or new database migration is needed. The task editor now lists only projects authorized for the selected team (Super Admin retains its server-supported override), clears project/module when switching teams, and surfaces scope-loading failures. Projects page explains this access model.

Hard: all 22 database tests, build and lint pass. New database regression creates four tasks across two developers/two shared projects, progresses each task, verifies admin visibility, and rejects unrelated project access. Browser regressions verify multiple project choices, saved project identity, team switching and the existing mobile developer workflow.
Purpose: developers can work across projects without exclusive assignments.
Liveliness: team changes clear stale context; unavailable scope disables project selection and shows errors.
Craft: existing form and project access controls reused; no new dependency or database change.

## Team member controls in team editing

The team pencil now opens “Edit team” with the name and current member controls. Super Admin can open a member's membership form with their existing team/lead values, move them, or choose “Remove from current team”; adding a member preselects the team and clears the previous selection. Team cards also expose Add member and Edit member directly. These controls reuse the existing membership command, which closes dated membership records and preserves history. Name and membership changes save separately.

Hard: build and lint pass; two targeted browser scenarios pass, including membership removal payload, correct defaults for adding, management command regressions and a 390px viewport.
Purpose: team membership is editable where the team is displayed and edited.
Liveliness: existing command errors and pending states retained; profile loading/errors are visible.
Craft: existing dialogs/buttons/list rows reused; no new backend permissions or database changes.

## Same-day membership changes after daily-note retirement

Migration 005 removes the obsolete guard that rejected same-day membership moves/removals whenever a daily record existed. Existing authorization, member validation, dated history, audit logging and task/daily-record team IDs are preserved. All 23 database tests pass, including moves, repeated same-day saves and removal after a daily record. Applied to the connected Supabase project after matching its command function to migration 004; verified the old guard was absent and security-definer behavior retained. Live verification with a tagged dummy account confirmed move/removal and historical team preservation inside a rolled-back transaction. No live memberships were changed by verification.

## Consistent form validation

All editable forms now use Zod with React Hook Form: team/project/module naming, membership changes, account management, project access, profiles, working calendars, holidays, leave types, Sheets configuration, task editing, contributors, comments and leave requests. Meeting notes/confirmation, leave decisions and report summary actions also validate before saving. Date ranges and summary dates display field-specific errors. Read-only fields, search/filter selects and direct status/archive actions remain ordinary controls.

Shared schemas validate whitespace, text limits, required selections, ISO dates, cross-field date/half-day rules, working days, domain lists and conditional spreadsheet IDs. Team-lead selection checks the selected account's role. The shared controlled-form hook revalidates after controlled values synchronize, clearing corrected errors without hiding errors on other fields. Existing Field associates errors with controls through aria-invalid and aria-describedby; checkbox groups have linked errors. Browser-native popups are disabled for forms so inline errors remain consistent. Server errors and database authorization remain intact.

Hard: 53 tests across seven unit/database suites pass. Five final targeted browser scenarios pass for management saves, meetings, historical summaries, invalid-form request blocking, comments/contributors and calendar correction. The prior broad browser run passed 23 existing scenarios and identified the corrected-field regression, now covered by a dedicated hook test and passing browser test. Build and lint pass. Final navigation/accessibility/mobile scan checked separately.
Purpose: invalid input is explained beside its field before a save request is sent.
Liveliness: failed submissions retain inputs; correcting one field preserves unrelated errors; pending and server-error behavior remains.
Craft: installed Zod/RHF and existing Field reused, without adding packages or changing database records.

## Blissora / shadcn system redesign

Direction follows the supplied sidebar/task-sheet and compact board references. Company colors were read from Blissora's public page and stylesheet: charcoal, green and lime, adapted for accessible product controls. DESIGN.md now defines source colors, semantic theme tokens, spacing/type/radii, component use, board/sheet behavior, validation and future verification. AGENTS.md and README direct future UI work to that design system. The standard @/ import alias is configured in Vite and TypeScript.

Shared primitives come from the official shadcn New York v4 registry, with local import paths and app theme adaptations: Button, Input, Textarea, Native Select, Checkbox, Label, Card, Table, Badge, Avatar, Alert, Skeleton, Dialog, Sheet, Tabs and Collapsible. Existing app-level Field/Dialog/feedback components compose these primitives. Native mobile select behavior is retained. Task details are a right-side sheet with real properties and Comments/Activity tabs; phone sheets fill the viewport. Task cards include actual description, owner and priority. The existing task queries, drag/drop and status menus are unchanged.

Hard: 53 unit/database tests, build and lint pass. Navigation/accessibility scans pass after correcting roster-button contrast, making table scrolling keyboard-accessible, and preventing low-contrast intermediate colors when switching themes. Screenshot review covered light/dark desktop boards and task sheets, plus a 390px full-height phone sheet. Broad browser workflow results are recorded below after the final run.
Purpose: shared components and documented tokens keep the whole workspace consistent with Blissora and the supplied layout references.
Liveliness: keyboard DnD, inline validation, loading/error/empty states, accessible overlay focus/Escape and reduced-motion behavior retained.
Craft: real desktop/phone renders inspected; theme tokens have a single definition; form controls preserve 44px touch targets and mobile 16px text. No fake data or decorative photography added to the product. Design-preview screenshots use browser-test fixtures only.

Final browser verification: all 25 existing workflow/mobile scenarios passed in the broad regression run. Final focused runs passed app-wide navigation/Axe scans, CSV/Excel reporting, the new six-card light/dark desktop and phone-sheet previews, and membership/snapshot Collapsible keyboard/expanded-state checks. The new preview fixture originally required its visibility assertion to target six cards rather than one; that test is corrected and passing. Build, lint and all 53 unit/database tests pass. Desktop card footer wrapping was visually reviewed and corrected before regenerating the screenshots.

Previews (browser-test fixtures): `docs/design-board-light.png`, `docs/design-board-dark.png`, `docs/design-task-sheet.png`, `docs/design-mobile-sheet.png`. Hosted frontend deployment was not performed.

## White minimalism and small color accents

The latest reference supersedes the green-tinted light canvas: light surfaces are now pure white, with near-white neutral lanes/sidebar, finer borders and no card shadows. Blissora green remains on primary actions. Shared ProjectTag uses a stable project-ID-based violet/blue/rose/cyan palette; initials use the same family. Low/medium/high priorities use blue/amber/orange, while urgent remains red. To do/In progress/Done dots use violet/blue/green. Paired dark tokens preserve readable contrast. DESIGN.md documents these roles and forbids tinting whole cards by category.

Hard: build and lint pass. App-wide navigation/mobile/Axe scan passes. Dedicated design coverage uses four real fixture project identities and varied priorities to verify light/dark label contrast, a pure-white canvas, responsive sheets and document overflow. Preview screenshots regenerated and visually inspected.
Purpose: color identifies projects and work states without overwhelming the white workspace.
Liveliness: all existing controls and data behavior retained; no color-only labels.
Craft: shared shadcn Badge/Avatar compositions and theme tokens reused; no new dependency or database change.

## Practical admin task register

Removed the detached wall of task-ID checkboxes. Admin selection now sits beside each task in compact aligned rows, with developer, priority, due date and status/actions on desktop. The header selects all visible tasks. Bulk controls appear only after selection and provide an explicit count and clear action; changing pages clears selection. Rows stack on phones, and filters have consistent internal padding. Developer boards are unchanged. DESIGN.md now requires this distinction between the admin register and developer work board.

Hard: build and lint pass. Three targeted browser scenarios passed: inline selection/select-all/bulk payload/clear, existing task editing, and app-wide navigation/mobile/accessibility. Final width adjustment reran the selection/mobile scenario successfully. Desktop/mobile register screenshots regenerated and visually reviewed; the status column reserves room for complete labels.
Purpose: users select a task where they read it, and can scan many tasks without scrolling through detached controls or oversized cards.
Liveliness: selection count, clear selection, current-page select-all and existing save/error states preserved.
Craft: shared shadcn Checkbox/Card/NativeSelect reused; no dependency or database change.

## Futuristic white workspace refinement

Added a static sync mark to the wordmark, compact breadcrumb capsule, monospaced IDs/counts/section labels, precise navigation accent, shallow panel depth and clearer hover/focus/selected-row treatment. White canvas, pastel identity labels, compact admin rows, inline selection and existing shadcn controls remain. DESIGN.md records the updated visual direction and ENERGY 3 / RHYTHM 2 / MOTION 1.

Hard: build and lint pass. Three browser scenarios passed for app-wide navigation/accessibility/mobile themes, board/sheet previews, and practical register selection/bulk saves. Regenerated desktop/mobile screenshots were visually inspected. No database changes or new dependencies.
Purpose: improve the technical visual character while preserving daily work density.
Liveliness: real selection state gets a surface/accent highlight; hover does not move controls; focus remains visible.
Craft: shared semantic tokens, restrained surface elevation and typography reused across screens. Existing reduced-motion behavior retained.

## Scoped task-card border correction

Reversed the broad border-removal pass after clarification. Inputs, selects, textareas, navigation, panels and dialogs retain their prior styling. Only the enclosing task-card borders in standups/boards are removed; register row separators and drag/focus indicators remain. DESIGN.md records the scope.

Build/lint pass. Three browser checks pass for standup saves, desktop/mobile themed previews and an explicit regression asserting zero task-card border width with restored 1px input/textarea borders. No data or permissions changed.

## Active accent border removal

Removed decorative active stripes from navigation, selected roster/register rows, page eyebrows and meeting/active-board headers. Selection backgrounds and keyboard focus indicators remain. DESIGN.md records this convention.

Build and lint pass. Both targeted browser checks pass: all navigation routes with desktop/mobile light/dark accessibility and overflow checks, plus explicit assertions that the meeting header has no top border and active navigation has no inset shadow. No data or permissions changed. Hosted deployment was not performed.

## Futuristic surface and motion refinement

Added requested GSAP and Framer Motion dependencies. GSAP runs a 320ms heading entrance with matchMedia cleanup; Framer Motion animates the selected navigation background using a shared layout ID and disables shared movement for reduced motion. Both respond to live preference changes. Text stays fully opaque and no animation delays interaction. Drag transforms remain owned by dnd-kit.

Refined the sync mark into a brand tile, recessed neutral board lanes, white task-card surfaces, shallow hover depth and a subtle primary-button highlight. Decorative active borders remain absent. DESIGN.md now records MOTION 2 and the ownership/accessibility rules. References: [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/) and [Motion shared layout](https://motion.dev/docs/react-layout-animations).

Build and lint pass. Seven browser tests pass: navigation/mobile/theme accessibility and overflow, themed board/sheet previews, inline register selection, border regression, normal/reduced motion, pointer dragging with save failure recovery, and keyboard movement/cancellation. Inspected generated light/dark desktop and dark mobile sheet screenshots; screenshot content is mocked fixture data. No database changes. Hosted deployment not performed. The requested animation packages add roughly 73 KB gzip to the current main bundle (existing Vite large-chunk warning remains).

## Immediate task drop feedback

Pointer tracking was already within 3px of the mouse after a single animation frame at three successive movement distances. The visible post-drop delay came from rendering only server-confirmed task status. Added a local pending move so the task appears in its destination immediately while the existing mutation saves and refreshes data. Pending state clears after reconciliation; failures restore the original server-backed task and retain the existing error. Version checks, cancellation and keyboard behavior are unchanged. DESIGN.md records the interaction rule.

Build/lint and five browser tests pass: pointer tracking, a blocked-server response proving the destination renders before save completion, existing pointer failure rollback, keyboard save/cancel, and desktop/mobile light/dark navigation accessibility/overflow. No database changes. Real-device latency and hosted deployment were not checked.

## Stable drag preview and smooth destination settling

Replaced moving the live task card with dnd-kit's DragOverlay, reusing the same card content in an inert, assistive-technology-hidden preview. The source footprint stays faded in place, and a soft preview shadow distinguishes the lifted card. Pointer movement remains un-eased; a 180ms ease-out drop animation lands at the actual destination card after React reconciliation rather than returning to the stale source position. Reduced motion skips settling. Immediate optimistic column updates and error rollback remain intact. No new dependencies. Reference: [dnd-kit DragOverlay](https://dndkit.com/react/components/drag-overlay/).

Seven browser checks pass across the two runs: pointer save/failure recovery; keyboard save/cancel; preview tracking within 3px after one animation frame in normal and reduced-motion modes; blocked-server drop with animation endpoint verified within 3px of the destination and 180ms duration; navigation light/dark mobile accessibility/overflow; and themed board/sheet previews. Build and lint pass. Hosted deployment and physical-device frame-rate profiling were not performed.

## Task drawer organization and status timeline

Reorganized the shadcn task sheet into a compact two-column overview, owner with avatar, description, contributors, and tabbed conversation/activity. Contributor controls retain their existing authorization and inline validation. Comments now include author avatars and Colombo timestamps, a multiline composer and an aligned submit action. The header and close control remain visible while the body scrolls. Contributor/comment loading and error states remain explicit.

History is a semantic ordered newest-first timeline with connected markers, actors, previous-to-new status badges and full Colombo dates/times. Creation entries come only from real history rows; empty history is stated explicitly. No schema or data changes. DESIGN.md records the layout/history convention.

Build/lint pass. Browser checks cover inline form validation, task comment errors, preserved field borders, themed board/sheet previews, all navigation routes with mobile accessibility/overflow, and a populated timeline with ordering/timezone assertions at 1440/768/390/360px in both themes. Inspected timeline desktop/mobile screenshots; fixture content is mocked. Hosted deployment not performed.

## Developer Overview, task calendar and day tracking

Separated developer routes: /dashboard is today's live board, /my-tasks is a full month calendar with a read-only selected-day agenda. Both retain assignment/contributor scope through the existing assigned-task query and RLS; the admin overview/register remain unchanged. The board shows all unfinished tasks and today's completions, excluding cancelled tasks and future scheduled starts. Past dates reconstruct end-of-day status from saved task history, display completions on completion day and label unavailable history. Historical title/detail metadata is explicitly identified as current; opening a task shows its current drawer.

Open tasks carry forward by date projection, without cloning task rows or creating new daily notes. Overview and calendar reuse all assigned tasks across paginated API batches, including old completions in the calendar. A Colombo-midnight/visibility hook updates both today's board and the shell date; task realtime events also invalidate status history. Creation dates are displayed on task cards, calendar entries and the drawer. The confirmed day-counter rule counts distinct configured workdays with recorded In progress intervals, excluding nonworking days/holidays, deduplicating same-day resumptions and respecting completion/blocking boundaries. Unknown/partial histories display unavailable or a lower bound, not invented time. No schema migration, backfill, data mutation or dependency installation required.

Build, lint and typecheck pass. All 57 unit/database tests pass, including four new date/status/workday tests (carry-forward, historical completion, weekends/holidays, repeated intervals, midnight boundaries, scheduled starts and missing history). All 36 browser checks verified across the full run and a targeted rerun: the full run passed 35; an obsolete board-heading assertion for redirected daily-note URLs was corrected to the new calendar heading and passed on rerun. New browser coverage verifies the distinct routes, past-day status, day counts, month navigation, current-detail context, read-only historical actions and midnight rollover without task duplication. Existing DnD, concurrency failures, form validation, projects/teams, reports and authorization checks remain passing.

Calendar Axe/overflow checks pass at 1440/768/390/360px in light/dark themes. Inspected desktop light and phone dark calendar screenshots using mocked fixtures. Updated DESIGN.md, README.md and PROGRESS.md for the new day-based convention. Hosted deployment and physical-device testing were not performed.

## React Big Calendar and full-width day sheet

Replaced the custom month table with React Big Calendar and its date-fns/en-GB localizer. Calendar dates remain normalized to Colombo business-day keys independently of browser timezone. Real historical task events are displayed; date buttons, blank day cells, task buttons and show-more open the selected day's shadcn bottom sheet. Removed the inline agenda and obsolete custom-grid CSS. The day sheet now spans 100% of the viewport on every screen size, is capped at 85dvh, and keeps its header/close control visible above scrollable content. Existing history reconstruction, carry-forward, workday counts and current-task detail context remain unchanged.

Task events use keyboard-accessible shadcn buttons inside table-cell event wrappers to preserve React Big Calendar's row semantics. The day sheet explicitly restores focus to the originating calendar control (or that day's date button if it was remounted). Current task details stack above the day sheet and return to it on close. DESIGN.md, README.md and PROGRESS.md record the convention. No data/schema changes.

Build/lint pass; four date/workday unit tests pass. Browser tests verify selection by keyboard, blank-cell click and task event, empty-day states, month controls, nested detail return, full-width bounds (x=0, width=viewport) at 1440/768/390/360px in both themes, bottom-aligned placement, Axe/overflow checks, dense-day show-more, body scrolling, visible close action, Escape focus restoration and disabled future days. Existing legacy redirects and admin/developer responsive checks also passed. Inspected desktop full-width sheet and mobile/calendar previews with mocked fixtures; modal screenshots use viewport capture. Hosted deployment and physical-device testing were not performed.

## Futuristic login with Hairline task cards

Used the Hairline create skill for concept selection and its visual/motion rules. The user selected task cards. Reused the official unmodified @lucasmarkes/hairline Riffle React figure rather than drawing a new engine/figure: the tray and tabbed cards retain their geometry and static hit areas; pointer/arrow-key selection lifts a card, with distance-staggered neighbours and the package's built-in tour. Since this is an existing packaged figure integrated into the application, no custom standalone HTML/kernel build or figure validator was needed. Reference: [Hairline documentation](https://hairline.lucasmarkes.com/docs).

Redesigned login around a deep Blissora panel with a lime/green-gray Hairline palette, revised task-based copy, a compact brand header and a white/minimal sign-in surface without the enclosing black card outline. The illustration is lazy-loaded; Google sign-in is immediately usable. Its introduction is capped at eight seconds with Pause/Replay controls, stops when the user takes over, and disables autoplay under reduced motion, including live preference changes. Hairline owns SVG motion and offscreen sleeping; text has only a short opaque Framer Motion entrance. On phones the brand panel becomes a compact two-column hero above sign-in. OAuth, error, busy and approval behavior are preserved.

Build/lint pass. Browser tests verify unchanged Google OAuth handoff and pending-account restriction; actual SVG geometry changes during the automated tour, bounded playback, keyboard and pointer response, and live reduced-motion behavior. Login Axe/overflow checks pass at 1440/768/390/360px in light/dark themes. Inspected desktop and phone screenshots in docs/login-hairline-*.png; figure, card tabs and tray stay inside the stage, the still pose reads as a tray of cards, geometry remains opaque with one stroke highlight, and controls/readout remain separate from the drawing. Updated DESIGN.md. Hosted deployment and physical-device performance checks were not performed.


## Login illustration refinement

Removed the visible task-card caption, readout and Pause/Replay buttons. Reused the installed Hairline Riffle on the right sign-in panel with theme-aware strokes and a canvas-matched plate. Both figures retain keyboard/pointer interaction and live reduced-motion support; automatic introductions stop after four seconds, with no persistent animation requiring playback controls. Updated DESIGN.md for future consistency.

Validation: production build and lint passed. Three targeted Playwright tests passed (Google OAuth request/callback, pending-account guard, and Hairline interaction/layout). Hairline coverage checks bounded autoplay, both figures' keyboard response, pointer response, reduced motion, no horizontal overflow and zero axe WCAG A/AA violations at 360, 390, 768 and 1440px in both themes. Reviewed desktop and phone screenshots. Hosted deployment and live Google authentication were not performed.


## Custom Orbit desk on login

Replaced the duplicate right-hand task tray with a new Orbit desk figure, mounted below the sign-in card at the bottom of the right container. The platter and three rounded tokens rotate together with horizontal pointer movement, use a spring to settle, and support arrow keys. A four-second tour stops on interaction; live reduced motion lands the geometry immediately. The left Riffle is unchanged. Uses the untouched Hairline kernel and retained MIT license, loaded only on login; an illustration load failure does not block sign-in.

The standalone figure passes the Hairline static validator and browser look checker: all intensity extremes stay in frame, readouts respond, no browser warnings/errors, and every pose settles. Reviewed the eight-pose sheet and sixteen-frame motion sheet: rounded silhouettes, opaque depth ordering, a single highlighted token, no crossing/flicker, recognizable platter at thumbnail size, both themes. Frame coverage is intentionally compact (24%) for a supporting footer illustration. The empty-state/source-specific checks do not apply. The tour visits left, right and front before resting; its visual narrative has not been user-judged.

Production build and lint passed. Targeted OAuth and pending-account guard tests passed; the updated login test verifies distinct left/right figures, bottom placement, actual arrow-key geometry changes, both themes at 360/390/768/1440px, no overflow, reduced motion and zero axe A/AA violations. Reviewed desktop and mobile renderings. No hosted deployment or live Google sign-in was performed.


## Robot companion refinement

Replaced the Orbit desk with the approved Robot companion at the bottom of the right login panel. Rounded feet, body, side arms, visor, eyes and an antenna establish the character. The head turns and nods on springs; eyes shift within the visor. The opening tour bows first and then looks sideways, stopping after four seconds or on input. Live reduced-motion, keyboard head turning, focus restoration and cleanup remain in the existing adapter. Pointer updates announce only changed readout values. No new dependency or authentication change.

The Hairline static validator and browser look checker pass: the robot remains in frame at both intensity extremes, responds with “hello”, returns to “rest”, settles without flickering, and emits no browser errors/warnings. Reviewed the eight-pose sheet and sixteen-frame motion strip. The small silhouette reads as a robot with a visor, antenna, arms and feet; opaque head geometry hides the neck, one face region carries the highlight, and rounded forms remain readable in both themes. Compact frame coverage (24%) is intentional for the supporting footer illustration. Empty-state and source-matching checks do not apply. The opening sequence has not yet been judged by the user.

Production build, lint and three targeted login browser tests passed. Tests cover OAuth initiation/callback, pending-account guard, real head geometry changes from keyboard input, bottom placement, reduced motion, overflow and axe A/AA at 360/390/768/1440px in both themes. Desktop and phone renderings were inspected. Hosted deployment and live Google sign-in were not performed.

## Login layout organization

Grouped the right-hand form and robot as one centered desktop stack instead of using auto vertical margins to push the figure to the bottom of the viewport. Set a shared 420px form width, consistent 16px content spacing and a smaller supporting figure. Mobile starts the content directly below the brand panel with 32px padding and a compact robot below it. Removed the redundant eyebrow, shortened the sign-in instruction, and grouped approval/privacy information beneath the Google action. Updated DESIGN.md to keep future changes consistent.

Production build and lint passed. Three login browser tests passed, covering OAuth initiation/callback, pending-account guard and Hairline keyboard/geometry/reduced-motion behavior. The login test checks no horizontal overflow and zero axe WCAG A/AA violations at 360/390/768/1440px in both themes. Reviewed light desktop and phone screenshots plus dark phone rendering. Authentication logic and illustration geometry were unchanged; hosted deployment and live Google sign-in were not performed.

Recommended the installed Hairline Relay as a possible future alternative: its connected tiles lift/light in sequence, matching the flow of team progress updates. No additional animation was installed or added.

## Hairline Relay on login

Replaced the robot with the installed official Relay React component, reusing the login illustration wrapper and compact responsive stack. Connected tiles light and rise along a selected branch. Preserved the four-second intro, pointer/focus cancellation and live reduced motion. Added an arrow-key adapter to cycle the component's five documented tour endpoints with a screen-reader-only live readout; blur returns to rest. Removed the unused custom robot, loader and standalone vendor kernel from the application. Historical figure previews remain in docs/hairline.

Production build, lint and all three targeted login browser tests passed. Checks include OAuth initiation/callback, pending-account guard, Relay keyboard readout and actual geometry changes, below-form placement, reduced-motion settling, overflow and zero axe WCAG A/AA violations at 360/390/768/1440px in both themes. Inspected desktop and phone renderings. No new package or custom geometry was added, so standalone custom-figure validation does not apply. No hosted deployment or live Google sign-in was performed.

## Welcome heading brand colors

Styled “Ora” in the login welcome heading with the existing semantic primary color; “Sync” retains the heading ink, matching the two-tone wordmark without changing heading typography. Documented the convention in DESIGN.md. Build and lint passed. The existing login browser check passed across mobile/desktop widths and both themes with zero axe A/AA violations. No new tests or dependencies were added for this color-only change; no deployment was performed.

## Team overview organization

Reworked the admin overview around a compact developer roster instead of repeated task feeds. Added name search, current-team filtering, clear filters, visible result counts and expandable task lists. Developers with blocked tasks sort first; status totals align as columns on desktop and labeled counts beneath the identity on phones. Current memberships are shown together. Preserved the existing TaskList for task details/status changes and retained workspace-wide metric scope. Removed the duplicated Current work section. Compact active-team summaries and a maximum of four actual blocked tasks with owner/reason sit in an independently sized sidebar. Archived-only teams now correctly show an empty state.

Build and lint passed. The new browser workflow verifies sorting, search/no-results, team filtering, clear filters, expanded task visibility, developers without work, exclusion of completed tasks, register links, and archived-team empty state. It checks overflow and zero axe WCAG A/AA violations at 360/390/768/1440px in both themes. The existing admin phone/tablet suite passed across all thirteen admin routes in both themes. Reviewed desktop and phone screenshots; corrected composed Radix trigger styling and gave expanded task status selectors a full mobile row so labels are readable. Authorization, database rules and the developer Today board were unchanged. No hosted deployment or live-data mutation was performed.

## Signed-in Google profile photo

The auth context now exposes the signed-in session’s HTTPS avatar_url, with picture as a fallback. The shared shadcn Avatar accepts an optional image source, uses object-cover/no-referrer, and retains Radix’s initials fallback for absent/failed images. Applied the photo to the sidebar identity and a new identity row on My profile. Other people’s avatars remain initials; no database migration, photo persistence, upload UI or authorization changes were introduced. Updated DESIGN.md.

Production build and lint passed. The isolated browser avatar workflow passed for avatar_url, picture, rejected HTTP avatar with valid picture, missing metadata and failed image requests. It verifies both sidebar and profile image sources/referrer policy and initials fallbacks, then checks phone/desktop overflow and zero axe WCAG A/AA violations in both themes. Existing pending-account and OAuth callback tests passed. Reviewed the profile rendering on mobile using a tiny test image, not a fabricated portrait. Live Google photo fetching and hosted deployment were not tested.

## Report table pagination

The task report previously rendered every matching row. Added 25-row display pages with Previous/Next, page totals and an announced visible range. Every report filter resets the page to the start; refreshed shorter results clamp to the last available page. Pagination stays outside the horizontally scrolling table, wraps on phones and is hidden for empty results. Metrics, exportTaskReport input, summaries and snapshots still receive the complete authorized result. Updated DESIGN.md.

Build and lint passed. The new browser workflow covers 58 rows across three pages, first/last disabled controls, visible-row boundaries, totals remaining 58, CSV exporting all 58 records while on page three, filter/date resets, exact 50-row final-page behavior and empty results. It checks overflow and zero axe WCAG A/AA violations at 360/390/1440px in both themes; desktop/light and mobile/dark pagination renderings were inspected. The existing CSV/XLSX download, clipboard summary and snapshot workflow also passed; its feedback assertion now distinguishes summary status from the new pagination live region. This is display pagination: all report data is still loaded for historical calculations and full exports. No hosted deployment or live database mutation was performed.

## Configurable report page size

Reports now default to 10 displayed rows and offer 10/25/50/100 in a labeled Rows per page selector. Changing the limit resets to page one and recalculates page totals/ranges; full-data exports and metrics are unchanged. Updated DESIGN.md. Build, lint and both report browser workflows passed, including every limit, page reset, pagination bounds, all-record CSV export, XLSX/snapshot/copy behavior and mobile/theme accessibility. Reviewed the mobile footer with the selector. Page size is local to the current reports visit; no persistence or backend paging was added. Not deployed.

## Teams, searchable selectors and shared Google avatars — 21 October 2026

Reorganized Teams with search by team/member, active/archived/all visibility, member counts and real linked-project tags. Cards size independently instead of stretching short teams. Existing membership/history controls remain; the page explains concurrent project access and links to Projects.

Installed React Select and migrated all application dropdowns through the shared NativeSelect compatibility API. Preserved controlled values, labels/error descriptions, RHF focus/change behavior, disabled options, keyboard search and semantic theme tokens. Task-editor selects now subscribe to RHF values so defaults, project resets and programmatic changes stay visible. Escape closes an open selector without closing its parent dialog/sheet. Mobile controls keep 44px targets and 16px text. Browser tests now interact with searchable options rather than native selectOption semantics.

Added profiles.avatar_url synchronization from each user’s own HTTPS Google metadata and applied 202610210001_google_profile_photos.sql to the configured Supabase database. Existing profile RLS/account approval remains unchanged; the backfill found eight profiles and two available Google photos. All authorized avatar locations (Teams, People, dashboard, standup, task owner/contributors/comments, sidebar and profile) use real photo sources, retaining initials for missing/failed photos. The migration is idempotent. Automatic approval review rejected the separate attempt to write the applied version into supabase_migrations.schema_migrations because that persistent operational metadata change could desynchronize future deployments and was not specifically authorized. Migration history was not changed.

The existing many-to-many team/project schema remains intact. Database regression coverage confirms two developers can each keep active tasks in two shared projects, while an unrelated project is denied. Photo trigger tests cover insert, metadata change, HTTPS fallback, metadata removal and restricted trigger-function execution.

Verification: production build and lint passed; all 58 unit/database tests passed. Full browser run passed 41 of 42 workflows; the remaining developer-screen check failed during trace-file cleanup due to overlapping test runs, not a page assertion. It passed when rerun independently, along with the final Teams workflow. Coverage includes all navigation/mobile themes, selector forms/validation, team member editing, search/archived filters, photos, multiple-project creation, task drag/drop, reports/export and calendar history. New Teams checks report no overflow or axe A/AA violations at 360/390/768/1440px in both themes. Desktop and phone Teams renderings were inspected. Frontend was not deployed; live Google OAuth was not rerun.

## 21 October 2026 — unfinished-task carry-forward

Removed the calendar's future-day/month lockout. Upcoming days project currently unfinished tasks, including In progress and Blocked, while respecting scheduled starts and excluding completed/cancelled tasks. Future sheets explicitly say Planned carry-forward; recorded workday counters stop at today. Original creation timestamps and historical records remain unchanged; no copies or scheduled database jobs are required.

Verified: production build, ESLint, 12 calendar/summary unit tests, and three Chromium workflows (Colombo midnight rollover, mobile show-more/focus restoration, tomorrow and next-month carry-forward). No production deployment or live-account end-to-end check was performed.

## 21 October 2026 — dropdown placement in modals

Shared React Select menus now use field-relative absolute placement rather than viewport-fixed coordinates inside transformed dialogs. Automatic placement and parent scrolling keep options reachable without leaving the modal focus scope. All task-status selectors use existing colored status badges for both menu options and selected values; other selectors retain their normal labels.

Build and lint passed. Browser regression checks cover anchored menu geometry, opening/selecting Team/Project/Status, selecting Done, and Escape preserving the modal at phone/desktop sizes in both themes. No database changes or production deployment.

## 21 October 2026 — dedicated card status picker

Task cards now align task/project identity and a compact status picker in the top header; the full-width status footer is removed. The separate TaskStatusPicker uses colored badges, plain-language descriptions, a current-status checkmark and a non-searchable keyboard-accessible React Select menu. Register rows retain their action-column alignment. Blocked selection still opens the validated blocker editor, and saves retain expected_updated_at concurrency checks.

Verified production build and lint; browser checks passed for task creation/status changes, optimistic drag updates, task detail drawer, and picker geometry/no horizontal overflow at 390px and 1440px in both themes. Inspected phone rendering. Browser helper clicks the visible select control rather than the hidden non-searchable accessibility input. Not deployed; no database changes.

### Compact status trigger

Removed the status trigger's gray container and fixed width, trimmed value padding, and prevented React Select's hidden non-searchable input from inheriting full form-input height. Kept the 44px hit target and focus outline. Picker browser regression passed at phone/desktop sizes in both themes; no behavior or data changes.

## 21 October 2026 — shared task completion heatmap

Added one reusable completion heatmap to developer Overview, My profile and each expanded developer in admin Team overview. It shows 365 days, green intensity levels, totals, active days and inspectable day counts. Dates use Asia/Colombo; history credits the owner at completion, deduplicates repeated same-day completions and retains completion activity after reopening. Tasks without completion history fall back to their recorded completed_at. Future dates are excluded. Queries retain existing Supabase RLS and share the existing React Query cache. Small screens scroll the chart internally, initially to recent dates; arrow keys navigate a single chart tab stop.

Verified build/lint, calculation regression (timezone, deduplication, reopened tasks, ownership, empty/future days and 365-day range), and browser reuse/counts on Overview/Profile/admin plus 390px/1440px light/dark layout checks. Inspected phone rendering. No database changes or deployment; browser data is mocked.

## 21 October 2026 — consolidated team management drawer

Team Edit opens a shadcn right-side sheet with team-name editing, member add/edit/move/removal and lead-role controls, project grant/removal, membership timeline and archive/restore. The existing membership form is reused inline in the drawer and retains validation/server error handling; global membership controls still use their existing dialog. Permissions and commands are unchanged, and existing work/history is retained. Drawer uses the established overlay stacking and a bounded scrolling body.

Verified production build and lint; browser workflows passed for preselected member/team, removal command, adding a member within the same drawer, inline required-name validation, save/project grant/archive payloads, history, close behavior and 390px/1440px layouts in light/dark themes. Inspected phone rendering. No production deployment or live-data changes; mutation checks use browser fixtures.

## 21 October 2026 — wider team drawer and reusable person picker

Expanded the team drawer to 960px on desktop and added section shortcuts plus two-column sections; small screens retain the stacked full-width layout. Added reusable PersonPicker on React Select, showing Google avatars with initials fallback, names, email and role, searchable across those identity fields. Membership forms use RHF Controller with existing Zod validation; Field directly associates label/errors with the picker. Selected photo/text is non-interactive so pointer input reaches the select.

Build/lint passed. Browser checks cover drawer width, section navigation, photo option/selected rendering, email search, selection, preselected membership/removal, save/project/archive actions, and light/dark phone/desktop layouts. No deployment or live-data changes.

## 21 October 2026 — functional team drawer tabs

Replaced scroll-only shortcuts with controlled shadcn Tabs. Details, Members, Projects and History show their own panels; archive/restore stays under Details and the history timeline opens expanded. Active-tab styling and keyboard semantics come from the shared tabs primitive. Existing parent-owned form state is retained when panels switch.

Build/lint passed. Updated browser regressions exercise member selection/saving, project tab visibility and access, history timeline, returning to Details and desktop/mobile drawer layouts. No database changes or deployment.

## 21 October 2026 — shared Add member popover

Team cards and team drawer Add member controls reuse a shadcn/Radix popover with the photo PersonPicker, fixed destination team, inline validation, existing-member exclusion and previous-team disclosure. Existing membership commands/security remain unchanged; saves close only the popover. Errors retain selection, duplicate saves are disabled and nested select Escape handling preserves overlay focus behavior.

Build/lint passed. Browser regressions verify both entry points, invalid submission feedback, correct membership payload, successful dismissal while retaining the drawer, preselected member editing, photo search/selection and responsive light/dark picker layouts. No deployment or live-data mutation.

## 21 October 2026 — consistent inset, rounded drawers

Added side metadata to shared SheetContent and centralized drawer geometry with --drawer-gap/--drawer-radius. Task details, team management and calendar bottom sheets now keep all corners rounded and margins from the viewport: 12px/20px desktop, 8px/16px phone. Feature widths remain intact within the viewport clamp; calendar height remains capped at 85dvh. DESIGN.md now makes this the required default for future drawers.

Verified build/lint and affected browser checks for team geometry/corner radius across phone/desktop themes, task drawer interactions and calendar bottom-sheet sizing/accessibility. No deployment or data changes.

Drawer geometry checks use reduced motion to measure settled rectangles independently of entry animation; task drawer workflow also passed with regular motion. Calendar checks passed at 360px, 390px, 768px and 1440px in both themes, including the new bottom margin. Team checks assert top/bottom/right gaps and corner radii. Inspected the phone drawer screenshot.

## 21 October 2026 — compact team drawer tabs

Removed extra header/navigation gap, tightened tab and header padding, and added section-specific colored icons with soft active-tab backgrounds using existing light/dark semantic tones. Preserved 44px tab targets and shadcn tab behavior. Verified build/lint and drawer tab workflows plus phone/desktop inset geometry. No deployment.

## 21 October 2026 — team summary cards

Replaced expanded roster/history cards with compact reference-inspired summaries: status badge, photo stack, actual lead, project tags/overflow, real task completion ratio, open/blocked counts and management footer. Add member still opens its shared popover; Manage team opens the existing tabbed drawer. No capacity metrics or team descriptions are invented. Member search continues using the full roster; project access and permissions are unchanged.

Build/lint passed. Browser regressions cover a real 1/2 completion ratio, photo rendering, project tags, member search, team visibility, mobile/theme layouts and Add member/Manage team actions. History remains in the drawer. No deployment or live database changes.

### More colorful team cards

Added stable identity tones (green/blue/violet/rose), a team icon tile and soft tinted lead, progress and footer details while retaining white card bodies. Existing theme tokens support dark mode. Build/lint and team-card browser checks cover mobile/desktop, themes, actions, counts and accessibility. No deployment or data changes.

### Consistent team card colors

Removed the per-team color selection. All team card icons, lead summaries, completion details and footers now share the Blissora green/soft-green tokens. Updated DESIGN.md. Existing status and project labels retain their semantic colors.

## 21 October 2026 — standup review redesign

Reorganized morning/evening standups around a searchable member roster, selected-member navigation, compact semantic summary tiles and counted task-group tabs. All-task review omits empty groups while individual filters keep empty states. Member selection resets filters. Notes, confirmation, task editing and permissions are unchanged. Added full-width task-card content in standups to prevent narrow title wrapping on phones.

Build/lint and three browser workflows passed: existing evening/task review, meeting-note saving, and member search/navigation/status filters with phone/desktop light/dark overflow checks. Inspected phone rendering and corrected narrow card wrapping. No deployment or live database changes.

## 21 October 2026 — native Supabase search, cmdk and register pagination

Added ranked full-text/partial/task-ID/typo-tolerant task search with pg_trgm and weighted GIN indexes. `search_tasks` is security-invoker with no service-role bypass; RLS scopes rows and exact counts. Validates filters/query/page/limits, uses deterministic ordering and clamps pages. Register defaults to 10 rows with 10/25/50/100 limits, exact ranges and page controls. Existing filters and bulk selection work with the displayed page. cmdk supplies Cmd/Ctrl+K search previews, query application and task drawer opening; requests debounce/cancel. Developer Today behavior is unchanged. No Algolia account or index is involved.

Production build, ESLint and all 61 unit/database tests passed. PostgreSQL tests cover full text, description, prefix, typo, SYNC ID, filters, page clamping, unrelated-user counts and anonymous denial. Browser checks passed for register bulk selection and 35-task pagination/limits/filter reset, cmdk shortcut/query/selection/Escape, empty results and phone/desktop light/dark screenshots. Inspected settled phone overlay.

Applied the additive migration to the configured Supabase database with certificate-verified TLS. Checked authenticated execution under RLS against live data: 10 returned / 62 total; anonymous execute false, authenticated execute true. No live task data changed. Frontend has not been deployed. Migration-history bookkeeping was not modified.

## 21 October 2026 — Netlify refresh/direct-route 404

Added netlify.toml with the Vite build command and dist publish directory. Added public/_redirects with the non-forced /* /index.html 200 SPA rewrite, supporting React Router refresh/direct navigation and auth callbacks while retaining existing static assets. Keeping the rewrite in the public output also supports manual dist uploads. Updated deployment instructions.

Production build passed; verified dist/index.html exists and dist/_redirects exactly matches the source fallback rule. No production Netlify deployment or live-site refresh verification was performed; a new deploy is required for the host to apply the rule.

## 21 October 2026 — Production Google OAuth redirects

Confirmed the frontend supplies window.location.origin + /auth/callback to Google OAuth. The reported localhost:3000 callback is consistent with the hosted Supabase Site URL fallback when the production callback is absent from its redirect allowlist. Recorded the confirmed production origin https://syncora-bliss.netlify.app and exact callback in google-oauth-setup.md. No frontend change is needed for this origin.

Hosted settings could not be inspected or changed: the Supabase dashboard requires sign-in and no management API credential was available. Production Google login remains unverified until the URL settings are saved and a fresh login is completed.

## 21 October 2026 — SyncOra favicon

Added public/favicon.svg using the existing Lucide sync mark and Blissora green tile colors, linked from index.html. Production build passed; verified valid SVG and that dist includes both the favicon asset and its HTML link. Live deployment and browser cache refresh were not checked.

## 21 October 2026 — pre-commit verification

Production build, ESLint and all 61 Vitest tests across nine files passed. git diff --check passed. Build retains large-chunk and upstream Zod annotation warnings. Reviewed tracked/untracked files; environment secrets and generated build/test output remain ignored. Secret-pattern scan only matched runtime-generated PEM test data in an unchanged existing test. Browser workflows and live production OAuth were not rerun for this commit.

## 25 October 2026 — realtime conversations and task comments

Replaced the shell's three-table subscription with a shared lifecycle hook covering task comments, activity/history, contributors, standup notes/assignments, daily updates/logs, tasks and leave. Matching React Query keys refresh on remote events; every successful subscription refreshes data to recover changes missed offline. Channels are removed on user changes/unmount. No local comment draft is reset and authorization policies remain unchanged. Added an idempotent publication migration.

Production build and ESLint passed; all 63 tests across ten files passed. New tests exercise incoming conversation/activity callbacks, reconnect catch-up, user changes/cleanup, publication membership/idempotency and retained comment RLS. Applied the migration to the configured Supabase database with certificate-verified TLS and verified all conversation/activity tables are published. No row data or migration-history changes. Build retains existing large-bundle and upstream Zod annotation warnings. Frontend not deployed; a live two-browser comment delivery check has not been performed.

Deployment rechecked on request: reran the idempotent realtime migration and verified all nine subscribed workspace tables belong to supabase_realtime with RLS enabled. No row data or migration-history bookkeeping changed.

## 25 October 2026 — email login and local Super Admin seed

Added email/password login alongside Google with shared form primitives, Zod/React Hook Form inline errors, password autocomplete/masking, pending state and generic authentication failures. Email sessions use the existing profile approval and role guards. Added npm run seed:admin: local-only Admin Auth API account creation for super-admin@example.com followed by trusted profile activation. Password and local service-role key must come from secret environment variables; no credentials or automatic production administrator are shipped. Existing users are not overwritten.

Build and lint passed; 64 app tests passed. Two seed tests verify rejection of remote targets/missing passwords and confirmed account creation plus exact profile activation using a mock local server. Browser tests passed for Google OAuth handoff and email validation/failed login/no horizontal overflow at 390px and 1440px. No actual seed account was created because a local instance/key/password have not been supplied. No production account, provider setting or deployment changed.

### Production seed support

Extended the trusted seed command with explicit --production opt-in and HTTPS-origin validation. Production can use the configured VITE_SUPABASE_URL, while privileged credentials stay exclusively in SUPABASE_SERVICE_ROLE_KEY and SEED_ADMIN_PASSWORD. Updated deployment instructions and empty environment placeholders. ESLint and all three seed tests passed (local mock account creation, credential validation, remote opt-in/HTTPS checks). No production user created: the admin key and seed password are absent from the local environment.

### Production Super Admin created — 25 October 2026

After the operator supplied secret environment credentials, ran the production seed for super-admin@example.com. Verified email/password authentication using the frontend publishable key and read back the account's active super_admin profile through its authenticated session. Signed out that verification session. No credentials were printed or added to source. The deployed frontend email form has not been verified.

## 25 October 2026 — organized login form

Fixed shrink-to-content email form sizing by stretching login panel children and making the form full width. Google, email/password inputs and email submit now share aligned edges. Added a quiet ruled email divider, 48px input heights, useful placeholders and concise intro copy. Retained shared primitives, validation, Google flow and Hairline components. Updated DESIGN.md. Build/lint and 64 app tests passed; two browser checks verified Google handoff, email failure/validation, equal control widths and no overflow at 390px/1440px. Inspected both responsive screenshots. Not deployed.

## 25 October 2026 — remove GitHub Actions

Removed the Application checks workflow (.github/workflows/checks.yml) at the operator’s request. Verified no YAML workflows remain. Local npm build/lint/test commands remain available. No application code changed; tests were not rerun for this workflow-only removal. The change must be pushed to stop future GitHub runs; existing run history is unchanged.
