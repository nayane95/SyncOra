# Local verification

Date: 20 October 2026 (Asia/Colombo).

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Strict TypeScript | PASS | `npm run typecheck`, including app, tests and Playwright configuration |
| ESLint | PASS | `npm run lint` |
| Business/component/database tests | PASS | 33 tests across four files with Vitest 5.0.5 |
| Real SQL/RLS execution | PASS | 16 cases execute both unchanged migration files in embedded PostgreSQL; only Supabase Auth infrastructure is a test fixture |
| Browser workflows | PASS | 11 Playwright scenarios with explicitly mocked Auth/REST/Realtime |
| Accessibility | PASS | Axe WCAG A/AA scan on all 13 admin pages; morning page in light/dark at 1440, 800 and 390px; no horizontal page overflow; 200% text sizing after content loads |
| Edge runtime types | PASS | Deno checks for all four function entrypoints |
| Edge pipeline mocks | PASS | Two Deno tests execute sync token signing, source queries, atomic reconciliation, corrections, failed job recording and current-profile authorization with mocked HTTP |
| Production bundle | PASS | `npm run build`; screen routes and ExcelJS load dynamically |
| Dependency audit | PASS | `npm audit`: zero reported advisories across production and development dependencies |
| Unconfigured startup | PASS | Running app at `http://127.0.0.1:5173/login`: setup heading, desktop Axe scan and 390px overflow check |

The browser scenarios exercise OAuth handoff, pending restrictions, developer route restrictions, task editing/validation, evening review, all admin routes, theme/mobile navigation, morning draft/confirmation, assignment dialogs, membership/project/calendar/profile forms, leave validation, daily hours/submission, CSV/XLSX download, WhatsApp copy/snapshot, empty data and recoverable network errors. Dialog tests check accessible naming, focus and Escape.

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

No live Supabase project or Google credentials were supplied. Real OAuth consent/callback, email delivery/provider settings, deployed RLS through PostgREST, cross-browser Realtime, deployed Edge secrets, actual Sheets writes and a live scheduler still require the release procedure in deployment.md. CI configuration was authored but has not run on a remote GitHub repository.

The export workbook and full Sheets reconciliation are held in memory, suited to the initial small team. Large histories may need durable export/sync jobs. Vite reports large shared/ExcelJS chunks; ExcelJS is loaded only when exporting and chart screens are separate chunks. npm dependency auditing cannot certify the absence of all vulnerabilities, including code prebundled by upstream packages; the app generates workbooks and does not accept untrusted XLSX uploads.

Local screenshots and mocks are proof of those tested UI states, not proof of real production data or service connectivity.
