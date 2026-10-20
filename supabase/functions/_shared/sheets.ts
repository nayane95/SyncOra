import { service, collect } from "./http.ts";
import { reconciliationRequests } from "./reconciliation.ts";
const encode = (input: Uint8Array | string) =>
  btoa(typeof input === "string" ? input : String.fromCharCode(...input))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
async function googleToken() {
  const account = JSON.parse(
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS") || "{}",
  );
  if (!account.client_email || !account.private_key)
    throw new Error("Google service account is not configured");
  const now = Math.floor(Date.now() / 1000),
    header = encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    claims = encode(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
  const pem = account.private_key
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${encode(signature)}`,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token)
    throw new Error("Google token exchange failed");
  return data.access_token as string;
}
async function google(path: string, token: string, body?: unknown) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) =>
        setTimeout(r, Math.min(8000, 1000 * 2 ** attempt)),
      );
      continue;
    }
    if (!res.ok)
      throw new Error(`Google Sheets request failed (${res.status})`);
    return await res.json();
  }
  throw new Error("Google Sheets retry limit exceeded");
}
export async function synchronize(requestedBy: string | null) {
  const db = service();
  const { data: config, error: configError } = await db
    .from("google_sheet_integrations")
    .select("*")
    .single();
  if (configError || !config?.enabled)
    throw new Error("Google Sheets integration is disabled");
  const sheetId =
    config.spreadsheet_id || Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");
  if (!sheetId || !/^[\w-]+$/.test(sheetId))
    throw new Error("Invalid spreadsheet ID");
  // An interrupted worker expires; regular runs are limited to the Edge Function execution window.
  await db
    .from("sync_jobs")
    .update({
      status: "failed",
      error: "Worker timed out; retry is safe",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("created_at", new Date(Date.now() - 10 * 60000).toISOString());
  const { data: job, error: jobError } = await db
    .from("sync_jobs")
    .insert({ requested_by: requestedBy })
    .select("id")
    .single();
  if (jobError || !job) throw new Error("A synchronization is already running");
  try {
    const logs = await collect((from, to) =>
      db
        .from("daily_work_logs")
        .select("*")
        .eq("status", "approved")
        .order("work_date")
        .order("id")
        .range(from, to),
    );
    const people = await collect((from, to) =>
      db
        .from("profiles")
        .select("id,name,role,job_title,status")
        .order("id")
        .range(from, to),
    );
    const teams = await collect((from, to) =>
      db.from("teams").select("id,name").order("id").range(from, to),
    );
    const modules = await collect((from, to) =>
      db.from("modules").select("id,name").order("id").range(from, to),
    );
    const updates: Record<string, unknown>[] = [];
    for (let i = 0; i < logs.length; i += 100) {
      updates.push(
        ...(await collect((from, to) =>
          db
            .from("daily_task_updates")
            .select("*")
            .in(
              "work_log_id",
              logs.slice(i, i + 100).map((l) => l.id),
            )
            .order("id")
            .range(from, to),
        )),
      );
    }
    const leaves = await collect((from, to) =>
      db
        .from("leave_requests")
        .select("id,developer_id,starts_on,ends_on,half_day,status")
        .eq("status", "approved")
        .order("id")
        .range(from, to),
    );
    const name = (id: unknown) =>
      people.find((p) => p.id === id)?.name || "Team member";
    const totals = new Map<string, number>();
    for (const l of logs) {
      const key = `${l.work_date.slice(0, 7)}|${l.developer_id}`;
      totals.set(
        key,
        (totals.get(key) || 0) +
          (["on_leave", "absent"].includes(l.attendance) ? 0 : Number(l.hours)),
      );
    }
    const tabs = [
      {
        title: "Daily Work Logs",
        headers: [
          "Source Record ID",
          "Date",
          "Developer",
          "Role",
          "Modules",
          "Key Work",
          "Hours Invested",
          "Team",
          "Update Status",
          "Last Synced At",
        ],
        records: logs.map((l) => [
          l.id,
          l.work_date,
          name(l.developer_id),
          people.find((p) => p.id === l.developer_id)?.job_title || "Developer",
          [
            ...new Set(
              updates
                .filter((u) => u.work_log_id === l.id)
                .map((u) => modules.find((m) => m.id === u.module_id)?.name)
                .filter(Boolean),
            ),
          ].join(", "),
          [l.completed_work, l.remaining_work, l.blockers, l.unplanned_work]
            .filter(Boolean)
            .join("\n"),
          ["on_leave", "absent"].includes(l.attendance) ? 0 : Number(l.hours),
          teams.find((t) => t.id === l.team_id)?.name || "",
          l.status,
          new Date().toISOString(),
        ]),
      },
      {
        title: "Task History",
        headers: [
          "Source Record ID",
          "Daily Log ID",
          "Task ID",
          "Title",
          "Status",
          "Notes",
        ],
        records: updates.map((u) => [
          u.id,
          u.work_log_id,
          u.task_id,
          u.title,
          u.status,
          u.notes,
        ]),
      },
      {
        title: "Developer Directory",
        headers: [
          "Source Record ID",
          "Developer",
          "Role",
          "Job Title",
          "Status",
        ],
        records: people.map((p) => [
          p.id,
          p.name,
          p.role,
          p.job_title,
          p.status,
        ]),
      },
      {
        title: "Leave Records",
        headers: [
          "Source Record ID",
          "Developer",
          "Start",
          "End",
          "Half Day",
          "Status",
        ],
        records: leaves.map((l) => [
          l.id,
          name(l.developer_id),
          l.starts_on,
          l.ends_on,
          l.half_day ? "Yes" : "No",
          l.status,
        ]),
      },
      {
        title: "Monthly Summary",
        headers: ["Month", "Developer", "Approved Hours"],
        records: [...totals].map(([key, total]) => [
          key.split("|")[0],
          name(key.split("|")[1]),
          total,
        ]),
      },
    ];
    const token = await googleToken();
    let metadata = await google(`${sheetId}?fields=sheets.properties`, token);
    const missing = tabs.filter(
      (tab) =>
        !metadata.sheets?.some(
          (s: { properties: { title: string } }) =>
            s.properties.title === tab.title,
        ),
    );
    if (missing.length) {
      await google(`${sheetId}:batchUpdate`, token, {
        requests: missing.map((tab) => ({
          addSheet: { properties: { title: tab.title } },
        })),
      });
      metadata = await google(`${sheetId}?fields=sheets.properties`, token);
    }
    // shortcut: one full reconciliation suits the initial small team; use durable batches when request size or runtime grows.
    const requests = reconciliationRequests(tabs, metadata.sheets);
    // One atomic batch reconciles corrections and removes stale rows without a clear/write gap.
    await google(`${sheetId}:batchUpdate`, token, { requests });
    const { error } = await db
      .from("sync_jobs")
      .update({
        status: "succeeded",
        records: logs.length,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) throw error;
    return { records: logs.length, jobId: job.id };
  } catch (error) {
    await db
      .from("sync_jobs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Sync failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    throw error;
  }
}
