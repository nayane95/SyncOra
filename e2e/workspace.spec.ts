import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const adminId = "00000000-0000-4000-8000-000000000001",
  devId = "00000000-0000-4000-8000-000000000002",
  teamId = "00000000-0000-4000-8000-000000000010",
  taskId = "00000000-0000-4000-8000-000000000020";
const now = new Date().toISOString(),
  date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
async function workspace(page: Page, role = "super_admin", status = "active") {
  await page.routeWebSocket("wss://syncora-test.supabase.co/**", (socket) => {
    socket.onMessage((raw) => {
      const [join, ref, topic, event] = JSON.parse(String(raw));
      if (event === "phx_join" || event === "heartbeat")
        socket.send(
          JSON.stringify([
            join,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: {} },
          ]),
        );
    });
  });
  const self = {
      id: role === "developer" ? devId : adminId,
      name: role === "developer" ? "Test Developer" : "Test Administrator",
      email: "tester@example.test",
      role,
      status,
      job_title: "Engineer",
      created_at: now,
      updated_at: now,
    },
    developer = {
      ...self,
      id: devId,
      name: "Test Developer",
      role: "developer",
      status: "active",
    };
  const task = {
    id: taskId,
    task_number: 1,
    title: "Verify daily work reporting",
    description: "Explicit test fixture",
    team_id: teamId,
    project_id: null,
    module_id: null,
    priority: "medium",
    status: "in_progress",
    assignee_id: devId,
    assigned_by: adminId,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: now,
    blocker: "",
    unplanned: false,
    target_date: null,
    start_date: null,
    completed_at: null,
    blocker_owner: null,
  };
  const log = {
    id: "00000000-0000-4000-8000-000000000030",
    developer_id: devId,
    team_id: teamId,
    work_date: date,
    hours: 8,
    attendance: "working",
    completed_work: "Finished the view",
    remaining_work: "Integration testing",
    blockers: "",
    unplanned_work: "",
    notes: "",
    status: "submitted",
    recorded_by: devId,
    reviewed_by: null,
    reviewed_at: null,
    review_note: "",
    created_at: now,
    updated_at: now,
  };
  const tables: Record<string, unknown[]> = {
    profiles: role === "developer" ? [self] : [self, developer],
    teams: [
      {
        id: teamId,
        name: "Test Team",
        archived: false,
        created_at: now,
        updated_at: now,
      },
    ],
    team_memberships: [
      {
        id: "member",
        team_id: teamId,
        developer_id: devId,
        is_lead: false,
        starts_on: "2020-01-01",
        ends_on: null,
        created_at: now,
      },
    ],
    tasks: [task],
    daily_work_logs: [log],
    working_calendar_settings: [
      {
        id: "calendar",
        working_days: [1, 2, 3, 4, 5],
        allowed_domains: [],
        timezone: "Asia/Colombo",
        created_at: now,
      },
    ],
    leave_types: [
      {
        id: "00000000-0000-4000-8000-000000000040",
        name: "Annual Leave",
        active: true,
        created_at: now,
      },
    ],
    google_sheet_integrations: [
      {
        id: "integration",
        enabled: false,
        spreadsheet_id: "",
        created_at: now,
      },
    ],
  };
  await page.addInitScript(
    ({ id, now }) => {
      localStorage.setItem(
        "sb-syncora-test-auth-token",
        JSON.stringify({
          access_token: "test-access-token",
          refresh_token: "test-refresh",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: {
            id,
            aud: "authenticated",
            role: "authenticated",
            email: "tester@example.test",
            created_at: now,
            app_metadata: { provider: "google" },
            user_metadata: {},
          },
        }),
      );
    },
    { id: self.id, now },
  );
  await page.route("https://syncora-test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url()),
      table = url.pathname.split("/").at(-1)!;
    if (url.pathname.includes("/auth/v1/user"))
      return route.fulfill({ json: { id: self.id, email: self.email } });
    if (url.pathname.includes("/rest/v1/rpc/command")) {
      const body = route.request().postDataJSON();
      if (body.action === "task") {
        Object.assign(task, body.payload, {
          updated_at: new Date().toISOString(),
        });
      }
      if (body.action === "review") {
        Object.assign(log, body.payload);
      }
      return route.fulfill({ json: body.action === "task" ? task : log });
    }
    let records = tables[table] || [];
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "offset", "limit"].includes(key)) continue;
      if (value.startsWith("eq."))
        records = records.filter(
          (r) => (r as Record<string, unknown>)[key] === value.slice(3),
        );
      if (value.startsWith("gte."))
        records = records.filter(
          (r) => String((r as Record<string, unknown>)[key]) >= value.slice(4),
        );
      if (value.startsWith("lte."))
        records = records.filter(
          (r) => String((r as Record<string, unknown>)[key]) <= value.slice(4),
        );
    }
    return route.fulfill({
      json: route.request().headers()["accept"]?.includes("vnd.pgrst.object")
        ? records[0] || null
        : records,
    });
  });
  return { tables, task, log };
}
test("pending accounts are kept out of the workspace", async ({ page }) => {
  await workspace(page, "developer", "pending");
  await page.goto("/admin/tasks");
  await expect(page).toHaveURL(/pending-approval/);
  await expect(
    page.getByRole("heading", { name: "Your account is awaiting approval" }),
  ).toBeVisible();
});
test("developers cannot enter management routes", async ({ page }) => {
  await workspace(page, "developer");
  await page.goto("/admin/tasks");
  await expect(page).toHaveURL(/access-denied/);
  await expect(
    page.getByRole("heading", { name: "Access is restricted" }),
  ).toBeVisible();
});
test("Google login uses Supabase OAuth and callback route", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.route(
    "https://syncora-test.supabase.co/auth/v1/authorize**",
    async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:5174/auth/callback",
      );
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");
      await route.fulfill({
        contentType: "text/html",
        body: "<h1>Google OAuth handoff test</h1>",
      });
    },
  );
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("heading", { name: "Google OAuth handoff test" }),
  ).toBeVisible();
});
test("task edit validates a blocker, saves a status and closes with Escape", async ({
  page,
}) => {
  const { task } = await workspace(page);
  await page.goto("/admin/tasks");
  await expect(
    page.getByRole("button", { name: task.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Edit ${task.title}` }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("blocked");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByRole("alert")).toContainText("Describe the blocker");
  await page.getByLabel("Blocker", { exact: true }).fill("Waiting for API");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(task.status).toBe("blocked");
  await page.getByRole("button", { name: task.title, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("evening review shows eight daily hours and approves a submitted update", async ({
  page,
}) => {
  const { log } = await workspace(page);
  await page.goto("/admin/evening-standup");
  await expect(
    page.getByText("8 hours reported", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review update", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Finished the view");
  await page.getByRole("button", { name: "Approve update" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(log.status).toBe("approved");
});
test("all navigation routes render; desktop and mobile themes have no overflow or serious accessibility violations", async ({
  page,
}) => {
  test.setTimeout(90000);
  await workspace(page);
  const routes = [
    "dashboard",
    "morning-standup",
    "evening-standup",
    "tasks",
    "teams",
    "developers",
    "projects",
    "leave",
    "approvals",
    "reports",
    "integrations",
    "settings",
    "audit-logs",
  ];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of routes) {
    await page.goto(`/admin/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("The workspace could not open")).toHaveCount(0);
    await expect(
      page.getByText("Loading workspace…", { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  for (const width of [1440, 800, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/morning-standup");
    await expect(
      page.getByRole("heading", { name: "Morning standup", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole("button", { name: "Use dark theme" }).click();
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme),
    ).toBe("dark");
    const dark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(dark.violations).toEqual([]);
    await page.getByRole("button", { name: "Use light theme" }).click();
  }
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/morning-standup");
  await expect(
    page.getByRole("button", {
      name: "Verify daily work reporting",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/standup-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/standup-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Task register", exact: true }).click();
  await expect(page).toHaveURL(/admin\/tasks/);
  await page.goto("/admin/morning-standup");
  await expect(
    page.getByRole("button", {
      name: "Verify daily work reporting",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("morning confirmation, assignment dialogs, notes and keyboard dismissal work", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/admin/morning-standup");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Review carry-forward work first.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Meeting draft saved.");
  await page.getByRole("button", { name: "Confirm today’s plan" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Meeting plan confirmed.",
  );
  await page
    .getByRole("button", { name: "Assign existing", exact: true })
    .click();
  await page.getByLabel("Existing task").selectOption(taskId);
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") && r.postDataJSON()?.action === "task",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Assign task", exact: true })
    .click();
  expect((await request).postDataJSON().payload.assignee_id).toBe(devId);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Assign task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Add a task");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("management dialogs, memberships, calendar and profile forms submit real commands", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/admin/teams");
  await page.getByRole("button", { name: "Create team" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Another test team");
  let request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    action: "team",
    payload: { name: "Another test team" },
  });
  await page.getByRole("button", { name: "Manage membership" }).click();
  await page.getByLabel("Team member", { exact: true }).selectOption(devId);
  await page.getByLabel("Team", { exact: true }).selectOption(teamId);
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Save membership" }).click();
  expect((await request).postDataJSON().action).toBe("membership");
  await page.goto("/admin/projects");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Test project");
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Save project" }).click();
  expect((await request).postDataJSON().action).toBe("project");
  await page.goto("/admin/settings");
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Save calendar" }).click();
  expect((await request).postDataJSON().payload.working_days).toEqual([
    1, 2, 3, 4, 5,
  ]);
  await page.getByLabel("Holiday name").fill("Test holiday");
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Add holiday" }).click();
  expect((await request).postDataJSON().action).toBe("holiday");
  await page.goto("/profile");
  await page.getByLabel("Name", { exact: true }).fill("Updated display name");
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    action: "profile",
    payload: { name: "Updated display name" },
  });
});
test("leave validation, request and editable daily update keep eight total hours", async ({
  page,
}) => {
  const { tables } = await workspace(page, "developer");
  tables.daily_work_logs = [];
  await page.goto("/my-leave");
  await page.getByRole("button", { name: "Request leave" }).click();
  await page
    .getByLabel("Leave type", { exact: true })
    .selectOption("00000000-0000-4000-8000-000000000040");
  await page.getByLabel("Start date").fill("2026-10-20");
  await page.getByLabel("End date").fill("2026-10-19");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "End date must follow start date",
  );
  await page.getByLabel("End date").fill("2026-10-20");
  let request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Submit request" }).click();
  expect((await request).postDataJSON().action).toBe("leave");
  await page.goto(`/my-updates/${date}`);
  await page
    .getByLabel("Work completed today")
    .fill("Implemented one task and tested another");
  await page.getByLabel("Hours worked").fill("8");
  await page
    .getByRole("checkbox", { name: /Verify daily work reporting/ })
    .check();
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Submit update" }).click();
  const payload = (await request).postDataJSON().payload;
  expect(payload.hours).toBe(8);
  expect(payload.task_updates).toEqual([{ task_id: taskId }]);
  await expect(page.getByRole("status")).toContainText(
    "Update submitted for review.",
  );
});
test("approved reports produce CSV and XLSX downloads, snapshot and copy preview", async ({
  page,
  context,
}) => {
  const { log } = await workspace(page);
  log.status = "approved";
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/admin/reports");
  await expect(
    page.getByRole("cell", { name: "Test Developer", exact: true }),
  ).toBeVisible();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  const xlsx = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByLabel("Team", { exact: true }).selectOption(teamId);
  await page.getByLabel("Summary style").selectOption("team");
  await page.getByRole("button", { name: "Copy summary" }).click();
  await expect(page.getByRole("status")).toContainText("Summary copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "*Test Team*",
  );
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") &&
      r.postDataJSON()?.action === "snapshot",
  );
  await page.getByRole("button", { name: "Save team snapshot" }).click();
  expect((await request).postDataJSON().payload.team_id).toBe(teamId);
});
test("empty and network-error states are visible and recoverable", async ({
  page,
}) => {
  const { tables } = await workspace(page);
  tables.tasks = [];
  await page.goto("/admin/tasks");
  await expect(
    page.getByRole("heading", { name: "No tasks match" }),
  ).toBeVisible();
  await page.route("**/rest/v1/tasks?**", (route) =>
    route.fulfill({
      status: 500,
      json: { message: "Temporary test network failure", code: "TEST" },
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Temporary test network failure",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
