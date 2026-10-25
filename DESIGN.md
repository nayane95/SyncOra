# SyncOra design system

This file is the source of truth for every new screen and UI change. Read it before changing UI. Reuse the installed components and CSS tokens; extend this document when an approved design decision changes.

## Direction and sources

SyncOra is Blissora's team delivery workspace. Follow the supplied ChronoTask reference for the inset sidebar, quiet neutral canvas, compact work cards and right-side task detail sheet. Follow the supplied AgroControl reference for readable card hierarchy, status columns and confident dark surfaces. Use the structure and density; keep SyncOra's own content and workflows.

Brand source: [Blissora](https://blissora.io), inspected 20 October 2026. Its public page and stylesheet use charcoal, greens such as `#1DBF72` / `#095228`, and lime `#A3FF80`. Those are the brand references. The accessible product adaptations below are authoritative for app controls.

Personality: clear, composed, collaborative. ENERGY 3 / RHYTHM 2 / MOTION 2. No marketing decoration in work screens. No invented progress percentages, identities or metrics. Do not copy the reference images' unrelated attachments, subtasks, agricultural imagery or example content into the product.

## Futuristic refinement

The latest direction is a white technical workspace: precise typography, a sync mark beside the wordmark, monospaced task IDs/counts/section labels, a compact breadcrumb capsule, fine panel edges and restrained surface depth. Keep the white-minimal palette, pastel identity labels and Blissora actions. Keep indicators tied to real data, the backdrop clean, and task information easy to scan.

Navigation, selected roster items and selected register rows use quiet background highlights without accent borders or inset stripes. Meeting headers have no decorative green top edge; hover/focus treatment supports scanning. Keep register rows compact, preserve inline selection and hide unused bulk controls. Use existing shadcn components. Do not animate theme colors or move controls on hover. GSAP animates page headings into place over 320ms on navigation; Framer Motion moves the selected navigation background between links with a damped spring. Text stays fully opaque and controls remain usable during animation. Both honor live reduced-motion preferences and clean up on unmount. Do not animate task-card transforms: drag-and-drop owns them. Avoid repeating, scrolling or ambient effects. White task cards sit on softly recessed neutral lanes with shallow hover elevation; the sync mark sits on a small brand-tinted tile.

## Login and Hairline illustration

The login pairs a deep Blissora green brand panel with a minimal sign-in surface. Reuse the official Hairline Riffle React component for the chosen task-card tray; do not fork its SVG geometry or animation engine. Set its plate to the panel ground and use the documented Hairline palette variables for lime highlights and green-gray lines. This is an illustration, not live task data. The automatic introduction is capped at four seconds, pauses on pointer/keyboard interaction without visible captions or playback controls. Group the sign-in form and supporting Hairline Relay as one vertically centered stack on desktop, with a controlled 16px gap and a 420px form width. Do not use auto vertical margins that push the illustration to the viewport bottom. Keep Relay below the form at 260px stage width (180px on phones). On phones, start the stack beneath the brand panel with 32px top padding. Omit redundant eyebrow copy above the welcome heading; group approval and privacy information in the note below the Google action. Relay uses the installed official React component: hovering a branch lights its links and lifts its tiles in sequence. Keep the four-second introduction, keyboard interaction and no perpetual motion. Its plate matches the sign-in canvas. Do not maintain a parallel custom kernel or illustration wrapper for built-in Hairline figures. No duplicate task-card animation on the right. Reduced motion prevents autoplay, responds to preference changes and keeps still interactive poses available. Keep the figure lazy-loaded so it cannot delay Google sign-in.

In the welcome heading, render SyncOra in the wordmark’s two tones: “Sync” inherits the heading ink and “Ora” uses the semantic primary color, including its accessible dark-theme equivalent. Keep it one readable brand name.

Login copy describes developer-owned tasks and daily progress; do not reintroduce fixed meeting times or admin task assignments. Keep the Google action prominent, preserve OAuth/approval/error behavior, and avoid enclosing it in a heavy outlined card. On phones use a compact two-column hero followed by sign-in, with no horizontal overflow. The left illustration never takes focus automatically. Motion is owned by Hairline for the figure; the text gets only a short, fully opaque entrance.

## Color and themes

Use semantic Tailwind classes from the `@theme inline` mapping in `src/app/styles.css`. Existing layout rules use the corresponding CSS variables. Never hardcode colors in feature components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#FFFFFF` | `#111813` | Workspace canvas |
| `--surface` | `#FFFFFF` | `#1C261F` | Cards, forms, sheets |
| `--ink` | `#23252A` | `#F0F4EC` | Primary text |
| `--muted` | `#656B75` | `#B1BDAF` | Supporting text |
| `--border` | `#E6E8ED` | `#3A493C` | Surface separation |
| `--input-border` | `#8B919B` | `#788B7A` | Interactive boundaries |
| `--accent` | `#176A45` | `#A3FF80` | Primary actions, active work, focus |
| `--on-accent` | `#FFFFFF` | `#172316` | Text on primary actions |
| `--accent-soft` | `#EDF6F0` | `#293D2B` | Selected navigation and soft emphasis |
| `--subtle` | `#F7F8FA` | `#263229` | Board lanes, subdued surfaces |

Use `bg-primary` / `text-primary-foreground`, `bg-card` / `text-card-foreground`, `border-border`, `text-muted-foreground`, and `ring-ring`. Brand lime is used with dark text, never as low-contrast text on white. Error and warning colors communicate real states; color must also have a text label. Both themes must work without photos or transparency. Restrict backdrop blur to modal overlays.

### White minimalism and color accents

The latest supplied reference takes precedence for the light theme: a white canvas and cards, near-white gray sidebar/lanes, fine neutral borders and minimal shadows. Avoid tinting large areas green. Blissora green remains the primary action/focus color; selected navigation is a quiet neutral gray.

Use restrained color on meaningful small elements. ProjectTag uses a stable project-ID-based violet/blue/rose/cyan palette, so a project's label does not change color with sorting or filtering. Avatar initials use the same accent family. These identity colors never imply status, team access or urgency. Priority labels retain text: low blue, medium amber, high orange, urgent red. Lane dots distinguish To do (violet), In progress (blue), Done (green). Never color entire task cards or lanes by category.

| Accent | Light text | Light background |
| --- | --- | --- |
| Violet | `#6941B7` | `#F2ECFF` |
| Blue | `#245FA7` | `#EAF2FF` |
| Rose | `#A03570` | `#FCEEF6` |
| Cyan | `#176B80` | `#E9F7FB` |
| Amber | `#865509` | `#FFF4D9` |
| Orange | `#A14515` | `#FFF0E5` |

Use the shared `--tone-*` and `--tone-*-soft` tokens, with paired dark-theme equivalents in styles.css. Do not introduce ad hoc pastel shades per feature. Keep labels readable to WCAG AA, with text alongside color.

## Shared components: shadcn/ui

All reusable primitives live in `src/components/ui`, based on the official shadcn New York registry. `components.json` records the setup. Keep modifications local to these source-owned components. Do not install a second UI kit or recreate feature-specific versions.

- Actions: `Button`, including icon and destructive variants. Icon-only actions require accessible names.
- Forms: `Input`, `Textarea`, `NativeSelect` / `NativeSelectOption`, `Checkbox` and `Label`. The legacy NativeSelect API now wraps React Select for every app dropdown: keep search, keyboard navigation, disabled options, inline error associations and semantic theme tokens in the shared adapter. Do not add raw select controls or separate per-feature select implementations. Keep task form selects controlled through React Hook Form values, and do not let Escape dismiss a parent dialog while a select menu is open. Use `Controller` for Radix Checkbox with React Hook Form.
- Surfaces: `Card`; tables use the shared `Table` family. Keep horizontal scrolling inside the table, never on the page.
- Feedback: `Alert`, `Badge`, `Skeleton`. Existing `ErrorState`, `Empty`, `Loading`, `Metrics` and `Field` are app compositions of shared primitives.
- Identity: the shared `ProjectTag` composes shadcn Badge for consistent project colors.
- People: `Avatar` uses the signed-in user’s Google `avatar_url` (or `picture`) from the authenticated session for the sidebar and My profile identity. Use HTTPS image sources, no-referrer requests, and the shadcn AvatarImage/AvatarFallback pair so missing or failed images show initials. Use the authorized profiles.avatar_url for all other avatar locations, synchronized from each user’s own Google metadata by the database trigger. Never copy the logged-in user’s photo onto another person. Missing/broken photos retain initials.
- Overlays: the app `Dialog` composes shadcn Dialog for forms and Sheet for task details (`side`). Maintain focus trapping, Escape and an accessible title/description.
- Task discussion: `Tabs` for Comments and Activity. Use `Collapsible` for membership history and saved snapshots. Only render working controls backed by real data.

Feature files must import these primitives instead of raw input/select/textarea/button/checkbox/table controls. Semantic layout elements and chart/library internals are exceptions. Add a new primitive from shadcn only when an actual feature needs it. Never change a primitive's behavior to solve a one-off page layout issue.

## Layout, type and spacing

Use the existing system sans stack; do not add a font service dependency. Page titles are 26–34px, weight 600, with slightly tight tracking. Body text is 13–14px; supporting metadata 11–12px. Counts and dates use tabular numerals. Avoid tiny text for primary actions.

Use a 4px spacing grid, typically 8/12/16/24/32px. Desktop navigation is a 236px inset panel; main content starts beside it, with a compact header and 28px content padding. Navigation must remain scrollable on short screens. At less than 1000px it becomes the existing mobile menu. Page headers align title/context with actions and wrap naturally.

Surfaces: 16px panels, 12px work cards, 9–10px controls, 20px overlays. Keep borders subtle and shadows shallow; stronger shadows belong to overlays. Task cards in boards and standups have no enclosing outline. Keep standard form-field borders, navigation, panel edges, keyboard focus indicators and register row separators. Do not wrap every text group in a card.

Task boards have three equal lanes on desktop: To do, In progress, Done. Use a restrained status dot, real counts and compact descriptions. Cards show task/project identity, title, short description when present, owner, priority and actual due date. Keep drag grips and status menus available. The developer Overview is today’s board in the Asia/Colombo business timezone: show all unfinished tasks plus tasks completed today. Carry unfinished tasks into each next day without cloning rows; hide future scheduled starts and cancelled tasks. Refresh the business date at midnight and when the tab resumes. My tasks uses React Big Calendar in month view with the date-fns localizer, Monday-first labels and Colombo business-date normalization. Use the existing shadcn month controls and semantic theme tokens around the library. Render real task events on their historical days; clicking a date, empty day cell, task event or show-more opens a shadcn bottom sheet containing that day’s read-only tasks. Do not keep a duplicate agenda below the calendar. The bottom sheet spans the available viewport width inside the shared drawer margins on desktop and phones, capped at 85dvh with a visible header/close action and scrolling task content. Opening current task details retains the day sheet underneath, so closing details returns to the selected day. Keep keyboard date activation, modal focus restoration, Escape dismissal, safe-area padding and reduced-motion support. Reconstruct past statuses from task history, show completions only on completion day, and open current task details with explicit selected-day context. Past titles/details are current unless versioned; never imply they are historical snapshots. Retain existing assignment/contributor scope and authorization. Use dnd-kit DragOverlay for a stable preview independent of column rerenders. Dragged cards must track the pointer without CSS or motion-library easing. Settle the preview into the actual destination card over 180ms with ease-out; skip settling with reduced motion. Keep the preview inert/hidden from assistive technology and preserve the source footprint during dragging. On drop, show the new column immediately while saving, retain the server version for concurrency checks, and restore the original column with an error if the save fails.

Task cards and the task drawer show the immutable creation date and “Days in progress.” Count distinct configured workdays with recorded In progress intervals, excluding weekends/holidays, counting same-day resumptions once and stopping at completion/blocked intervals. Do not count waiting time or infer hours worked. When history is missing, display unavailable or “At least” for partial records. Calendar counts include carried open tasks, not just tasks created that day. Keep month controls, Today action, status legend and selected-day state readable at 360px.

Teams use compact cards sized to their own content, with member counts, linked project tags and clear Add member/Edit actions. Search by team or member and default to active teams; archived teams remain available through the searchable visibility selector. Keep membership history collapsed. Team project access is additive and many-to-many: all authorized members may work on several linked projects concurrently; do not turn project access into an exclusive assignment.

The admin Team overview is a workload review screen. Keep compact workspace-wide counts above a searchable developer roster; filter the roster by current developer team membership without changing the workspace totals. Sort developers with blocked work first, then by name. Collapsed rows align developer/team identity with In progress, Blocked and Open counts; use shadcn Collapsible to reveal the existing TaskList only when requested. Show every current team membership and explicit empty states. On phones, put labeled counts under each identity, stack filters, and give task status selectors a full row so labels remain readable. Use a compact, independently sized sidebar for active-team summaries and at most four actual blocked tasks with their blocker text and owner. Do not stretch short summaries to the roster height or repeat a separate Current work task feed below it. Provide working links to standup and the task register. Preserve existing scope, authorization, task updates and detail drawers.

The admin task register is a compact, aligned list for scanning many developers' tasks. Each selection checkbox belongs in its task row; never render a separate cloud of IDs. Show task identity/title, developer, priority, due date and status/actions in columns on wide screens. Stack essential content on phones. Bulk controls stay hidden until at least one task is selected, with visible count, clear selection and select-all for the current page. Clear selection when filters or pages change. Keep filters padded and separated from the list. Developer boards remain a separate work-focused view.

Task details use a right-side sheet, up to 620px wide, with a fixed header/close action and independently scrolling body. Group status, priority and dates in a compact two-column overview, followed by the owner, description and contributors. Comments show avatars, authors and Colombo timestamps; keep the composer below the discussion with a clearly aligned submit action. Activity uses a semantic newest-first ordered timeline: connected markers, actor, old-to-new status labels and full Colombo date/time. Handle creation, empty history and loading/errors explicitly. Do not invent history events. On phones, use a nearly full-height sheet inside the shared drawer margins with readable padding. Forms remain focused centered dialogs, with a bounded height and internal scrolling.

Reports default to 10 task rows per page. Offer 10, 25, 50 and 100 in a labeled Rows per page selector, resetting to page one when the limit changes. Include Previous/Next controls, page totals and a visible result range. Reset to the first page when any report filter changes; clamp the visible page if refreshed data shrinks. Paginate only the displayed table. Metrics, CSV/Excel exports, summaries and snapshots must continue to use all authorized matching records. Keep pagination outside the horizontally scrolling table and readable on phones.

## Forms and behavior

Every editable form uses Zod and React Hook Form. Reuse `src/lib/form-schemas.ts`, the existing task/leave schemas, and `useValidatedForm` for controlled fields. Use `Field` for inline errors and programmatic error associations. Invalid submissions must not send commands. Errors clear when corrected without erasing other field errors. Preserve user input on server failure, show the server error, and disable duplicate saves while pending.

Retain all existing authorization, team/project scope, audit history, historical data rules and data loading/error/empty states. No UI change may silently broaden access or substitute fake content for missing data.

## Mobile and accessibility

Test 360px, 390px, 768px and desktop. Controls and touch actions have at least 44px interaction height; small checkboxes sit inside padded labels. On mobile, inputs use 16px text to prevent browser zoom. Board lanes stack; filter rows and actions reflow; tables scroll inside their region. Do not truncate required labels, hide validation feedback or cause horizontal document overflow.

Meet WCAG AA contrast. Preserve keyboard navigation, visible focus, form labels and errors, reduced-motion preference, and non-drag status changes. Motion is limited to short state transitions; skeleton animation stops under reduced motion. Theme colors switch together without text/background color fades, so contrast remains readable during theme changes.

## Verification for future changes

Before delivering UI changes: run build and lint, relevant validation/unit tests, browser workflows affected by the change, and the existing navigation/mobile/accessibility checks. Inspect an actual desktop and phone rendering in both themes. Update `docs/verification.md` with what was verified and any limit. Update this file when changing a token, shared component convention or layout rule, so future screens remain consistent.

Future calendar days project currently unfinished tasks until completion/cancellation, respecting scheduled starts. Label these as planned carry-forward, allow future day/month navigation, and cap recorded workday counts at today. Preserve original creation dates and historical statuses; projections do not create task records.

React Select menus stay inside their dialog/sheet focus scope and use absolute positioning with automatic above/below placement and a bounded scrollable list. Do not use viewport-fixed menu coordinates inside transformed overlays. Task-status choices and selected values reuse semantic status badges (violet To do, blue In progress, orange Blocked, green Done); always retain the text label and keyboard focus indicators.

Task cards place the dedicated TaskStatusPicker in the top-right header beside task/project identity. Use a compact non-searchable React Select trigger, semantic status badges, concise action descriptions and a checkmark on the current choice. Keep the menu keyboard accessible, field-relative and automatically placed. Preserve blocked-task validation and concurrency checks; card metadata and discussion remain below the title. Register rows keep the picker aligned in their existing action column.

Status picker triggers are content-width badges with a nearby chevron on a transparent background. Avoid nested padded gray containers; keep a 44px interaction target without enlarging the visible badge.

Reuse DeveloperCompletionHeatmap for developer Overview, My profile and expanded developers in admin Team overview. Show a rolling 365-day GitHub-style grid with a Blissora green intensity scale, total completions, active days, dates/counts and a legend. Each cell counts distinct tasks completed that Colombo day, credited to their owner recorded in completion history; use completed_at only for tasks without completion history. Reopened tasks keep recorded completions, and repeated completion of one task on the same day counts once. Never represent task counts as hours or a productivity score. Respect existing RLS, show loading/errors, and don't invent missing history. The grid scrolls horizontally on phones and opens at recent days; keyboard arrows navigate cells with a single chart tab stop.

Team Edit opens a right-side TeamManagementDrawer, up to 680px on desktop and available viewport width inside drawer margins on phones. Group team details, active members, an inline validated membership editor, additive project access, collapsed membership history and archive/restore in separate sections. Keep the header/close action visible with a scrolling body. Member edits stay in the drawer and scroll into view; preserve historical memberships and existing role restrictions. Reuse Google avatars, React Select, Zod/RHF and existing command actions. Archive retains historical data; project access remains many-to-many.

TeamManagementDrawer expands to 960px on desktop, with section shortcuts and a two-column members/project-access layout; phones keep a stacked sheet inside drawer margins. Reuse PersonPicker for person selection: searchable name/email/role, Google profile photo (initials fallback), clearable selection, role labels, keyboard navigation and inline RHF/Zod errors. Selected avatar/text must not intercept input pointer events. Never use another person's photo as fallback.

Team drawer navigation uses shadcn Tabs, not scroll shortcuts. Details contains rename/archive controls; Members contains the roster and inline person/membership editor; Projects contains access controls; History contains the expanded membership timeline. Only the selected panel is visible. Retain form values across switches and support arrow-key navigation with an explicit active-tab highlight.

Every team Add member trigger uses AddTeamMemberPopover, built from the shared shadcn Popover primitive. The popover contains PersonPicker, the fixed target team, inline Zod/RHF validation and Add to team/Cancel actions. Exclude existing active team members and disclose when selection moves someone from another team. Keep popovers above drawer overlays, collision-aware on phones, and preserve the underlying drawer after saving/dismissal. Existing member edits remain in the Members panel.

## Shared drawer shape and placement

Every drawer uses the shared SheetContent primitive and its data-side attribute. Keep all four corners rounded, with visible viewport space on every exposed edge: 12px gap / 20px radius on desktop, 8px gap / 16px radius below 600px. Use --drawer-gap and --drawer-radius in the shared sheet rules. Right/left drawers fill the available height inside these margins and retain their feature-specific widths, clamped to the inset viewport. Top/bottom sheets span the inset viewport width; calendar bottom sheets retain their 85dvh height cap. Never override mobile drawers to edge-to-edge, square-corner or zero-margin layouts. Clip the outer surface to the radius and scroll the inner content while preserving header/close controls, focus restoration, safe-area padding and reduced-motion behavior. This applies to existing task/team/calendar drawers and all future drawers.

Keep the team drawer title/description and tab strip compact: no extra flex gap between header and navigation, tight description margins, and 44px tab hit targets. Add small section icons with existing semantic tones (Details green, Members blue, Projects violet, History amber). Only the active tab receives its soft tinted background; inactive labels stay neutral with tinted icons. All four tabs must fit at 390px without the History label clipping. Retain shadcn keyboard semantics and visible focus.

Team list cards use a compact overview composition: heading and Active/Archived badge; overlapping Google avatars (up to five, then overflow count); actual team lead names or Not assigned; up to two linked project tags plus an overflow count; actual completed/non-cancelled task counts with a labeled progress track and open/blocked totals. This track describes current task completion across the team’s authorized tasks, never sprint capacity or an invented utilization percentage. The quiet footer shows the team’s recorded update date, quick Add member popover and Manage team action. Move detailed rosters, member controls, history and archive/restore into the existing management drawer. Preserve member search, project scope and read-only role restrictions; use explicit loading/errors/empty states.

All team cards use the same Blissora green accent and soft green surface tokens; do not vary card colors by team identity. Apply the tone to the team icon tile, lead summary, project section label, completion count/track and quiet footer; retain white main surfaces and independent semantic Active/Archived badges. Use this shared palette consistently across all team cards. Use the existing dark-mode tone pairs and retain readable focus/contrast.

Standups use compact tinted real-count metrics, a searchable roster with in-progress/blocked counts, and a selected-member header with Previous/Next navigation. Task review uses shadcn tabs (All tasks, To do, In progress, Blocked, Done) with status icons and counts. All tasks omits empty groups; individual filters retain an explicit empty state. Member selection resets the task filter. Keep white surfaces, green selection, semantic blue/orange/green summaries, and existing meeting-note validation/save/confirmation. On phones the roster is bounded and scrollable, filters scroll internally, task cards give titles the full content width, and person navigation wraps below identity. Do not add simulated progress or decorative ongoing motion.

## Task register search and pagination

Use Supabase/PostgreSQL for task search; no external Algolia index or credentials. The search_tasks RPC is security-invoker and retains task RLS for both rows and counts. It combines weighted English full-text ranking, literal partial title/description matches, exact SYNC-number lookup and pg_trgm word matching. Search input is debounced 200ms, bounded to 200 characters, and obsolete requests are aborted. Existing status/team/project/module/developer/priority filters apply server-side.

The register defaults to 10 rows and offers 10/25/50/100. Show exact result ranges, page totals and Previous/Next; reset to page one and clear bulk selection when search, filters or limit change. Clamp pages after results shrink. Fetch only the displayed page; do not download all tasks to paginate locally. Developer Today boards retain their carry-forward behavior.

Use cmdk inside the existing shadcn Dialog for the register's quick search, opened by its visible button or Cmd/Ctrl+K. Show up to ten authorized previews with task IDs/status and an action to apply the query to the paginated register. Selection opens the existing task drawer. Keep loading/error/no-result feedback, arrow/Enter/Escape support, focus restoration and theme/mobile styling.

Email sign-in uses the shared Input, Field and Button components with Zod/React Hook Form inline validation. Keep Google sign-in available above the email form, use username/current-password autocomplete, mask passwords and show generic authentication failures. Never display seed credentials on the login page. Email sessions use the same approval and role guards as Google.

The login form uses one aligned 420px column: stretch the panel children and keep the email form full width. Separate Google and email sign-in with quiet horizontal rules around a short label; use 48px email controls and consistent field spacing. Keep the trust note and Hairline illustration beneath the form.
