# Google Sheets

The app works with this integration disabled. Supabase remains authoritative.

## Configure

1. Enable the Google Sheets API in Google Cloud.
2. Create a service account restricted to the intended use. Download a JSON key and store it in a secrets manager, never in source control or browser variables.
3. Create a dedicated reporting spreadsheet. Share it with the service account's `client_email` as an editor. Restrict spreadsheet sharing because it contains work records.
4. Configure Edge Function secrets using a local, ignored secrets file, not a committed file:

```text
APP_ORIGIN=https://YOUR_FRONTEND_ORIGIN
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS={the complete single-line service account JSON}
GOOGLE_SHEETS_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
SCHEDULE_SECRET=YOUR_SEPARATE_RANDOM_SECRET
```

```sh
supabase secrets set --env-file /YOUR_PRIVATE_PATH/syncora-secrets.env
supabase functions deploy google-sheets-sync
supabase functions deploy scheduled-sync
```

5. As Super Admin, open Integrations, enter the spreadsheet ID and enable sync. Save, then run Sync approved records.

## Managed tabs and reconciliation

The integration owns these five tabs: Daily Work Logs, Task History, Developer Directory, Leave Records, Monthly Summary. Do not put manual data in these tabs. Other tabs are untouched.

Daily logs and task snapshots are approved-only. Leave rows are approved-only. Directory rows describe accounts; private leave reasons and email addresses are excluded. Source UUIDs are exported for traceability. Monthly hours aggregate approved daily records once and exclude leave/absence.

The job creates missing tabs, then sends an atomic `batchUpdate` replacing cell values from row zero through the managed range. This removes stale rows, incorporates corrections/reopened approvals and avoids append duplicates. Text is written as `stringValue`, so report notes cannot become formulas. A unique partial index permits one running sync job. A timed-out job becomes failed after ten minutes; retries rebuild the same desired tab state. Google 429/5xx responses use bounded exponential retry.

This is full reconciliation for an initially small team. Large histories may exceed Edge Function runtime or Google request limits; migrate to durable batch processing when that becomes necessary. A spreadsheet can be updated even if recording the final job status fails; retrying is safe.

## Scheduling

Use Supabase Cron plus pg_net, or an HTTPS scheduler that supports secret headers. POST to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduled-sync`

Send `Content-Type: application/json`, `x-schedule-secret: YOUR_SCHEDULE_SECRET`, and body `{}`. Store the secret in Supabase Vault/the scheduler secret store. Do not hardcode it in a migration. A daily run at 12:30 UTC corresponds to 18:00 Asia/Colombo. If using Supabase Cron, make the `net.http_post` headers read the secret from Vault and set a timeout consistent with the Edge Function limit. No schedule is installed automatically.

Verify the endpoint rejects a missing/wrong secret. Run twice, correct an approved record through the revision/reapproval workflow, run again, and check that the original source ID's row is corrected without a duplicate. Review sync_jobs and deployed function logs on failure.
