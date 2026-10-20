import { synchronize } from "./sheets.ts";
import { authorize } from "./http.ts";
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
Deno.test(
  "Sheets pipeline reconciles corrections without duplicates and records failures",
  async () => {
    const originalFetch = globalThis.fetch;
    const keys = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const exported = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", keys.privateKey),
    );
    Deno.env.set("SUPABASE_URL", "https://edge-test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-key");
    Deno.env.set("SUPABASE_ANON_KEY", "test-only-public-key");
    Deno.env.set(
      "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS",
      JSON.stringify({
        client_email: "test@fixture.invalid",
        private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...exported))}\n-----END PRIVATE KEY-----`,
      }),
    );
    const log = {
      id: "log-1",
      work_date: "2026-10-19",
      developer_id: "dev-1",
      team_id: "team-1",
      status: "approved",
      hours: 8,
      attendance: "working",
      completed_work: "Fixture work",
      remaining_work: "Testing",
      blockers: "",
      unplanned_work: "",
    };
    const titles = [
      "Daily Work Logs",
      "Task History",
      "Developer Directory",
      "Leave Records",
      "Monthly Summary",
    ];
    const workbook = new Map<
      string,
      {
        values: {
          userEnteredValue: { stringValue?: string; numberValue?: number };
        }[];
      }[]
    >();
    const jobs: { id: string; status: string; error?: string }[] = [];
    let failGoogle = false,
      approvedFilterChecked = false;
    const response = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    globalThis.fetch = async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init),
        url = new URL(req.url);
      if (url.hostname === "oauth2.googleapis.com") {
        const body = await req.text();
        assert(body.includes("assertion="), "Missing signed Google assertion");
        return response({ access_token: "mock-google-token" });
      }
      if (url.hostname === "sheets.googleapis.com") {
        if (failGoogle)
          return response({ error: "Spreadsheet unavailable" }, 403);
        if (req.method === "GET")
          return response({
            sheets: titles.map((title, i) => ({
              properties: {
                sheetId: i,
                title,
                gridProperties: { rowCount: 1000, columnCount: 10 },
              },
            })),
          });
        const payload = await req.json();
        assert(
          payload.requests.every(
            (r: Record<string, unknown>) => !("appendCells" in r),
          ),
          "Sync must never append",
        );
        for (const r of payload.requests)
          if (r.updateCells) {
            assert(
              r.updateCells.range.startRowIndex === 0,
              "Reconciliation must start from row zero",
            );
            workbook.set(
              titles[r.updateCells.range.sheetId],
              r.updateCells.rows,
            );
          }
        return response({ replies: [] });
      }
      const table = url.pathname.split("/").at(-1);
      if (table === "google_sheet_integrations")
        return response({
          id: "integration",
          enabled: true,
          spreadsheet_id: "fixture-sheet",
        });
      if (table === "sync_jobs") {
        if (req.method === "POST") {
          const job = { id: `job-${jobs.length + 1}`, status: "running" };
          jobs.push(job);
          return response({ id: job.id });
        }
        if (req.method === "PATCH" && url.searchParams.has("id")) {
          const job = jobs.find(
            (j) => `eq.${j.id}` === url.searchParams.get("id"),
          );
          Object.assign(job!, await req.json());
        }
        return response([]);
      }
      if (table === "daily_work_logs") {
        assert(
          url.searchParams.get("status") === "eq.approved",
          "Only approved logs may sync",
        );
        approvedFilterChecked = true;
        return response([log]);
      }
      if (table === "profiles")
        return response([
          {
            id: "dev-1",
            name: "Fixture Developer",
            role: "developer",
            job_title: "Frontend",
            status: "active",
          },
        ]);
      if (table === "teams")
        return response([{ id: "team-1", name: "Fixture Team" }]);
      if (table === "modules")
        return response([{ id: "module-1", name: "Case details" }]);
      if (table === "daily_task_updates")
        return response([
          {
            id: "update-1",
            work_log_id: "log-1",
            task_id: "task-1",
            module_id: "module-1",
            title: "Fixture task",
            status: "in_progress",
            notes: "=unsafe formula text",
          },
        ]);
      if (table === "leave_requests") return response([]);
      throw new Error(`Unexpected request: ${url.pathname}`);
    };
    try {
      await synchronize("admin-1");
      await synchronize("admin-1");
      assert(
        approvedFilterChecked,
        "Approved-only source query was not observed",
      );
      let rows = workbook.get("Daily Work Logs")!;
      assert(rows.length === 2, "Repeated runs duplicated the source record");
      assert(
        rows[1].values[6].userEnteredValue.numberValue === 8,
        "Daily hours were not preserved",
      );
      log.hours = 6;
      await synchronize("admin-1");
      rows = workbook.get("Daily Work Logs")!;
      assert(
        rows.length === 2 &&
          rows[1].values[6].userEnteredValue.numberValue === 6,
        "A correction must replace the original row",
      );
      assert(
        jobs.every((j) => j.status === "succeeded"),
        "Completed jobs must be marked succeeded",
      );
      failGoogle = true;
      let failed = false;
      try {
        await synchronize("admin-1");
      } catch {
        failed = true;
      }
      assert(failed, "Google errors must propagate");
      assert(
        jobs.at(-1)?.status === "failed",
        "Failed jobs must remain retryable and observable",
      );
    } finally {
      globalThis.fetch = originalFetch;
      for (const key of [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS",
      ])
        Deno.env.delete(key);
    }
  },
);
Deno.test(
  "manual sync authorization validates current account role and status",
  async () => {
    const originalFetch = globalThis.fetch;
    Deno.env.set("SUPABASE_URL", "https://edge-test.supabase.co");
    Deno.env.set("SUPABASE_ANON_KEY", "test-only-public-key");
    let role = "super_admin",
      status = "active";
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return new Response(
        JSON.stringify(
          url.pathname.includes("/auth/v1/user")
            ? { id: "user-1", email: "fixture@test.invalid" }
            : { id: "user-1", role, status },
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    };
    const req = new Request("https://fixture.invalid", {
      headers: { Authorization: "Bearer fixture-user-token" },
    });
    try {
      assert(
        (await authorize(req, true)).userId === "user-1",
        "Active Super Admin should be authorized",
      );
      for (const state of [
        ["developer", "active"],
        ["super_admin", "pending"],
        ["super_admin", "inactive"],
      ]) {
        [role, status] = state;
        let rejected = false;
        try {
          await authorize(req, true);
        } catch {
          rejected = true;
        }
        assert(rejected, `Must reject ${role}/${status}`);
      }
      let rejected = false;
      try {
        await authorize(new Request("https://fixture.invalid"), true);
      } catch {
        rejected = true;
      }
      assert(rejected, "Missing token must be rejected");
    } finally {
      globalThis.fetch = originalFetch;
      Deno.env.delete("SUPABASE_URL");
      Deno.env.delete("SUPABASE_ANON_KEY");
    }
  },
);
