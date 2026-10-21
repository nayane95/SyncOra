# Removable test data

These scripts are manual SQL operations, not migrations or automatic deployment seeds. They require the existing active Super Admin `nayanajithdev@gmail.com`.

## Basic sandbox

`seed.sql` creates `[TEST] Sandbox`, two projects, 24 tasks, 24 comments and three morning standups assigned to the existing administrator. It does not create identities. It rejects repeat seeding.

## Developers and task history

`scenarios.sql` adds a separate dataset without modifying the basic sandbox:

- Six active developer profiles with clearly marked `[TEST]` names, `.invalid` email addresses, no passwords or linked OAuth identities, and permanently banned Auth users. These are display/test records, not accounts you can sign in with.
- `[TEST] Product Engineering` and `[TEST] Platform Engineering`, with three developers each.
- `[TEST] Client Portal` and `[TEST] Delivery Platform`, with six modules across them.
- 36 tasks with specific acceptance criteria, covering frontend, API, QA, delivery, search and reporting work. Each developer has To do, In progress, Blocked, one completion this week and two older completions.
- 90 explicitly synthetic, dated task-status events and 72 comments.
- Morning/evening standups across the last three weeks of weekdays; 60 on the initial deployment date, 20 October 2026. The exact count varies with the day of seeding.

No retired daily-note records are created. Existing account roles, memberships, calendar settings and integrations are not changed. Duplicate seeding is rejected. Fake account creation still respects the project's signup-domain trigger; a restricted domain configuration can reject `.invalid` addresses and roll back the seed.

Refresh the application and use Team overview or the meeting team selector to inspect the new teams. Open task details for status history and comments. Older completions remain in the admin task register while the developer Done column shows the current week.

## Remove after testing

Run `cleanup.sql` against the same project, or ask Codex to remove the test data. It removes **all work in all three reserved test teams**, including tasks, comments, histories, standups, memberships and records you add during testing. It also removes the four test projects/modules and the six marked dummy accounts. Real accounts are preserved.

Cleanup is transactional and repeatable. It refuses altered test-team names, dummy Auth identities that no longer carry the batch marker and permanent ban, or test projects reused by other teams. Unexpected foreign-key references also roll back the entire cleanup. Keep testing inside the reserved teams; do not move test work or dummy users into real teams.

Historical audit entries remain. References to deleted dummy actors are replaced by a `removed_test_actor` detail so their profiles can be removed without erasing audit evidence. Downloaded exports, screenshots and any external Google Sheets copies need separate removal.

Automated SQL coverage checks seed counts, duplicate rejection, dated history, banned dummy identities, refusal to delete an altered dummy identity, repeatable cleanup, preservation of unrelated tasks/accounts and absence of new daily-note records. The extended dataset was applied to the configured Supabase project and verified transactionally before commit.
