# Permissions

| Operation | Developer | Admin / lead | Super Admin |
|---|---|---|---|
| Profile | Own only | Own and members of managed teams | All |
| Task read | Primary assignee or contributor | Managed team | All |
| Task status/blocker | Own assigned/contributed tasks | Managed team | All |
| Task assignment/metadata | Own unplanned work creation only | Managed team | All |
| Daily work read/write | Own editable records | Managed team; admin capture attributed | All; admin capture attributed |
| Review daily work | No | Managed team, different developer | All, different developer |
| Leave | Own request/history/cancel | Team review/cancel, no self-review | All review, no self-review |
| Teams, roles, projects, scope, settings | No | Read managed scope | Manage |
| Work exports/snapshots | No | Managed scope | All |
| Sheets configuration/sync | No | No | Yes |
| Audit logs | No | No | Read only |

An Admin must also have an active lead membership for the managed team. Role names alone do not confer team access. Membership history grants historical reporting context but does not let a former lead manage a team after their lead membership ends.

Pending, rejected, and inactive profiles cannot call commands or read application tables. They may read only their own profile to render the account-status screen. Deactivation takes effect in RLS immediately even if the Supabase session token remains valid. The UI refreshes profile state with Realtime and periodic checks.

The database uses current server-controlled profiles, not client-editable user metadata or role claims. Audit history and server ownership columns cannot be changed through direct table requests.

Leave reasons are private to the requester and authorized reviewers. They are excluded from reports/Sheets. The developer roster exposes availability to leads; developers do not receive other developers' private records.

The public publishable/anon key is safe to distribute only with these grants and RLS policies. Never ship service-role or Google credentials in any `VITE_` variable. The scheduled sync secret is independent of the service role and must be stored in Vault or the scheduler's secret store.
