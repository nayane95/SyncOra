import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Task } from "../src/types/database";
async function selectOption(control: Locator, value: string) {
  if ((await control.getAttribute("aria-expanded")) !== "true")
    await control
      .locator('xpath=ancestor::div[@data-slot="native-select-wrapper"]')
      .locator(".app-select__control")
      .click();
  const page = control.page();
  await page
    .locator('[role="option"]')
    .filter({
      has: page.locator("[data-select-value=" + JSON.stringify(value) + "]"),
    })
    .click();
}
async function expectValue(control: Locator, value: string | RegExp) {
  if ((await control.getAttribute("role")) === "combobox") {
    if (
      value === "" &&
      (await control
        .locator('xpath=ancestor::div[@data-slot="native-select-wrapper"]')
        .evaluate((element) => element.classList.contains("person-picker")))
    ) {
      await expect(
        control
          .locator('xpath=ancestor::div[@data-slot="native-select-wrapper"]')
          .locator(".app-select__single-value"),
      ).toHaveCount(0);
      return;
    }
    await expect(
      control
        .locator('xpath=ancestor::div[@data-slot="native-select-wrapper"]')
        .locator(".app-select__single-value [data-select-value]"),
    ).toHaveAttribute("data-select-value", value);
  } else await expect(control).toHaveValue(value);
}
async function expectOptions(control: Locator, labels: string[]) {
  await control.click();
  await expect(control.page().getByRole("option")).toHaveText(labels);
  await control.press("Escape");
}
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
async function workspace(
  page: Page,
  role = "super_admin",
  status = "active",
  metadata: Record<string, unknown> = {},
) {
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
  const task: Task = {
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
    ({ id, now, metadata }) => {
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
            user_metadata: metadata,
          },
        }),
      );
    },
    { id: self.id, now, metadata },
  );
  await page.route("https://syncora-test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url()),
      table = url.pathname.split("/").at(-1)!;
    if (url.pathname.includes("/auth/v1/user"))
      return route.fulfill({ json: { id: self.id, email: self.email } });
    if (url.pathname.includes("/rest/v1/rpc/search_tasks")) {
      const {
        p_query = "",
        p_filters = {},
        p_page = 0,
        p_limit = 10,
      } = route.request().postDataJSON();
      const query = String(p_query).toLowerCase();
      const matching = (tables.tasks as Record<string, unknown>[]).filter(
        (task) =>
          Object.entries(p_filters).every(
            ([key, value]) => task[key] === value,
          ) &&
          (!query ||
            `${task.title} ${task.description} SYNC-${task.task_number}`
              .toLowerCase()
              .includes(query)),
      );
      const page = Math.min(
        p_page,
        Math.max(0, Math.ceil(matching.length / p_limit) - 1),
      );
      return route.fulfill({
        json: {
          items: matching.slice(page * p_limit, (page + 1) * p_limit),
          total: matching.length,
          page,
          limit: p_limit,
        },
      });
    }
    if (url.pathname.includes("/rest/v1/rpc/command")) {
      const body = route.request().postDataJSON();
      if (body.action === "task") {
        Object.assign(task, body.payload, {
          updated_at: new Date().toISOString(),
          completed_at:
            body.payload.status === "completed"
              ? new Date().toISOString()
              : null,
        });
      }
      if (body.action === "review") {
        Object.assign(log, body.payload);
      }
      return route.fulfill({ json: body.action === "task" ? task : log });
    }
    let records = tables[table] || [];
    for (const [key, value] of url.searchParams) {
      if (key === "or" && value.includes("completed_at.gte.")) {
        const start = value.match(/completed_at\.gte\.([^,]+)/)![1];
        const end = value.match(/completed_at\.lt\.([^,)]+)/)![1];
        records = records.filter((row) => {
          const task = row as { status: string; completed_at?: string | null };
          return (
            !["completed", "cancelled"].includes(task.status) ||
            (task.status === "completed" &&
              !!task.completed_at &&
              Date.parse(task.completed_at) >= Date.parse(start) &&
              Date.parse(task.completed_at) < Date.parse(end))
          );
        });
      }
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
  await selectOption(page.getByLabel("Status", { exact: true }), "blocked");
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
test("evening standup reviews task progress without daily notes or approvals", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/admin/evening-standup");
  await expect(
    page.getByRole("button", {
      name: "Verify daily work reporting",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Record update|Review update|Approve update/,
    }),
  ).toHaveCount(0);
  await expect(page.getByText("8 hours reported", { exact: true })).toHaveCount(
    0,
  );
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

test("standups review developer tasks and save meeting notes without assignment controls", async ({
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
  await expect(
    page.getByRole("button", { name: "Assign task", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Assign existing", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Verify daily work reporting",
      exact: true,
    }),
  ).toBeVisible();
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
  await selectOption(page.getByLabel("Team member", { exact: true }), devId);
  await selectOption(page.getByLabel("Team", { exact: true }), teamId);
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
test("leave validation and requests work independently of daily notes", async ({
  page,
}) => {
  await workspace(page, "developer");
  await page.goto("/my-leave");
  await page.getByRole("button", { name: "Request leave" }).click();
  await selectOption(
    page.getByLabel("Leave type", { exact: true }),
    "00000000-0000-4000-8000-000000000040",
  );
  await page.getByLabel("Start date").fill("2026-10-20");
  await page.getByLabel("End date").fill("2026-10-19");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "End date must follow start date",
  );
  await page.getByLabel("End date").fill("2026-10-20");
  const request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.getByRole("button", { name: "Submit request" }).click();
  expect((await request).postDataJSON().action).toBe("leave");
});
test("task reports without daily notes produce CSV and XLSX downloads, snapshot and copy preview", async ({
  page,
  context,
}) => {
  const { tables } = await workspace(page);
  tables.daily_work_logs = [];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/admin/reports");
  await expect(
    page.getByRole("cell", { name: "Test Developer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Task progress report" }),
  ).toBeVisible();
  await expect(page.getByText("Approved hours", { exact: true })).toHaveCount(
    0,
  );
  await selectOption(
    page.getByLabel("Task status", { exact: true }),
    "completed",
  );
  await expect(
    page.getByRole("heading", { name: "No tasks match this report" }),
  ).toBeVisible();
  await selectOption(page.getByLabel("Task status", { exact: true }), "");
  await expect(
    page.getByRole("cell", { name: "Test Developer", exact: true }),
  ).toBeVisible();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const csvDownload = await csv;
  expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/);
  const stream = await csvDownload.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(content).toContain('"Task ID","Title","Developer"');
  expect(content).toContain("Test Developer");
  expect(content).not.toContain("Hours Invested");
  const xlsx = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/\.xlsx$/);
  await selectOption(page.getByLabel("Team", { exact: true }), teamId);
  await selectOption(page.getByLabel("Summary style"), "team");
  await page.getByRole("button", { name: "Copy summary" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Summary copied." }),
  ).toBeVisible();
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

test("retired daily-note routes redirect to tasks and no longer appear in navigation", async ({
  page,
}) => {
  await workspace(page, "developer");
  await page.setViewportSize({ width: 360, height: 780 });
  const dailyRequests: string[] = [];
  page.on("request", (r) => {
    if (/rest\/v1\/daily_(work_logs|task_updates)/.test(r.url()))
      dailyRequests.push(r.url());
  });
  for (const route of ["/my-updates", `/my-updates/${date}`, "/my-history"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/my-tasks$/);
    await expect(
      page.getByRole("heading", { name: "My tasks", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Daily notes|Work history/ }),
  ).toHaveCount(0);
  expect(dailyRequests).toEqual([]);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("admin and developer screens fit narrow phones and tablets in both themes", async ({
  page,
}) => {
  test.setTimeout(120000);
  await workspace(page);
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      for (const route of [
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
      ]) {
        await page.goto(`/admin/${route}`);
        await expect(page.locator("h1")).toBeVisible();
        await expect(
          page.getByText("Loading workspace…", { exact: true }),
        ).toHaveCount(0);
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}px ${theme} ${route}`,
        ).toBe(true);
      }
    }
  }
});

test("developer screens fit phones and tablets without daily-note controls", async ({
  page,
}) => {
  test.setTimeout(90000);
  await workspace(page, "developer");
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      for (const route of [
        "/dashboard",
        "/my-tasks",
        "/my-leave",
        "/profile",
        "/notifications",
      ]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await expect(
          page.getByText("Loading workspace…", { exact: true }),
        ).toHaveCount(0);
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route,
        ).toBe(true);
      }
    }
  }
  await page.goto(`/my-updates/${date}`);
  await expect(page.getByLabel("Hours worked")).toHaveCount(0);
  await expect(page.getByLabel("Work completed today")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit update" })).toHaveCount(
    0,
  );
});

test("developers create tasks from their home and move work through progress without logging hours", async ({
  page,
}) => {
  await workspace(page, "developer");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Today’s tasks", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add my task", exact: true }).click();
  await page.getByLabel("Task title").fill("My own implementation");
  await expectValue(page.getByLabel("Team", { exact: true }), teamId);
  await expect(page.getByLabel("Assignee", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Hours worked")).toHaveCount(0);
  let request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") && r.postDataJSON()?.action === "task",
  );
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  expect((await request).postDataJSON().payload).toMatchObject({
    title: "My own implementation",
    assignee_id: devId,
    team_id: teamId,
    status: "planned",
    unplanned: false,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "My own implementation", exact: true }),
  ).toBeVisible();
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await selectOption(page.getByLabel("Status for SYNC-1"), "in_progress");
  expect((await request).postDataJSON().payload.status).toBe("in_progress");
  await expectValue(page.getByLabel("Status for SYNC-1"), "in_progress");
  request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await selectOption(page.getByLabel("Status for SYNC-1"), "completed");
  expect((await request).postDataJSON().payload.status).toBe("completed");
  await expect(
    page.getByRole("region", { name: "Done tasks", exact: true }),
  ).toContainText("My own implementation");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "/private/tmp/syncora-developer-board.png",
    fullPage: true,
  });
});

test("dnd-kit saves moves and preserves the task when a save fails", async ({
  page,
}) => {
  const { task, tables } = await workspace(page, "developer");
  tables.tasks = [
    task,
    {
      ...task,
      id: "00000000-0000-4000-8000-000000000051",
      task_number: 2,
      title: "Review dashboard layout",
      status: "planned",
    },
    {
      ...task,
      id: "00000000-0000-4000-8000-000000000052",
      task_number: 3,
      title: "Finish search validation",
      status: "completed",
      completed_at: now,
    },
  ];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  const handle = page.getByRole("button", {
    name: /^Move SYNC-1\./,
    exact: true,
  });
  const request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  async function moveToColumn(name: string) {
    await expect(
      page.locator("[data-dnd-dragging], [data-dnd-dropping]"),
    ).toHaveCount(0);
    const origin = (await handle.boundingBox())!;
    const target = (await page
      .getByRole("region", { name, exact: true })
      .boundingBox())!;
    await page.mouse.move(
      origin.x + origin.width / 2,
      origin.y + origin.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      origin.x + origin.width / 2 + 15,
      origin.y + origin.height / 2,
      { steps: 5 },
    );
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 20 },
    );
    await page.mouse.up();
    await expect(
      page.locator("[data-dnd-dragging], [data-dnd-dropping]"),
    ).toHaveCount(0);
  }
  await moveToColumn("To do tasks");
  expect((await request).postDataJSON().payload).toMatchObject({
    id: taskId,
    status: "planned",
    expected_updated_at: now,
  });
  await expect(
    page.getByRole("region", { name: "To do tasks", exact: true }),
  ).toContainText("Verify daily work reporting");
  await expect(page.locator(".board-feedback")).toHaveText(
    "SYNC-1 moved to To do.",
  );
  await page.screenshot({
    path: "/private/tmp/syncora-task-board-desktop.png",
    fullPage: true,
  });
  await page.route("**/rest/v1/rpc/command", (route) =>
    route.fulfill({
      status: 409,
      json: { message: "Task changed. Refresh before saving." },
    }),
  );
  await moveToColumn("Done tasks");
  await expect(page.getByRole("alert")).toContainText(
    "Task changed. Refresh before saving.",
  );
  await expect(
    page.getByRole("region", { name: "To do tasks", exact: true }),
  ).toContainText("Verify daily work reporting");
  await expectValue(page.getByLabel("Status for SYNC-1"), "planned");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/syncora-task-board-mobile.png",
    fullPage: true,
  });
});

test("dnd-kit keyboard movement can be cancelled or saved", async ({
  page,
}) => {
  await workspace(page, "developer");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  const handle = page.getByRole("button", { name: /^Move SYNC-1\./ });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(
    page.locator("[data-dnd-dragging], [data-dnd-dropping]"),
  ).toHaveCount(0);
  await expectValue(page.getByLabel("Status for SYNC-1"), "in_progress");
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-dnd-dragging]")).toHaveCount(1);
  const source = (await page
    .getByRole("region", { name: "In progress tasks", exact: true })
    .boundingBox())!;
  const target = (await page
    .getByRole("region", { name: "To do tasks", exact: true })
    .boundingBox())!;
  for (let i = 0; i < Math.round((source.x - target.x) / 10); i++)
    await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("region", { name: "To do tasks", exact: true }),
  ).toHaveClass(/is-drop-target/);
  const request = page.waitForRequest((r) => r.url().includes("/rpc/command"));
  await page.keyboard.press("Space");
  expect((await request).postDataJSON().payload.status).toBe("planned");
  await expect(
    page.getByRole("region", { name: "To do tasks", exact: true }),
  ).toContainText("Verify daily work reporting");
  await expect(page.getByText("Drop a task here", { exact: true })).toHaveCount(
    0,
  );
});

test("Overview shows today's completions and carries unfinished work forward", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-21T06:00:00Z"));
  const { task, tables } = await workspace(page, "developer");
  tables.tasks = [
    {
      ...task,
      id: "done-yesterday",
      task_number: 101,
      title: "Finished yesterday",
      status: "completed",
      completed_at: "2026-10-20T06:00:00Z",
    },
    {
      ...task,
      id: "done-today",
      task_number: 102,
      title: "Finished today",
      status: "completed",
      completed_at: "2026-10-20T18:30:00Z",
    },
    {
      ...task,
      id: "old-open",
      task_number: 103,
      title: "Unfinished from last week",
      status: "in_progress",
      created_at: "2026-10-12T06:00:00Z",
    },
    {
      ...task,
      id: "scheduled",
      task_number: 104,
      title: "Scheduled for next week",
      status: "planned",
      start_date: "2026-10-26",
    },
  ];
  const request = page.waitForRequest((r) =>
    r.url().includes("/rest/v1/tasks?"),
  );
  await page.goto("/dashboard");
  const query = new URL((await request).url()).searchParams
    .getAll("or")
    .join(" ");
  expect(query).toContain(devId);
  await expect(
    page.getByRole("region", { name: "Done tasks", exact: true }),
  ).toContainText("Finished today");
  await expect(
    page.getByText("Finished yesterday", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Scheduled for next week", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "In progress tasks", exact: true }),
  ).toContainText("Unfinished from last week");
  await expect(
    page.getByText("Carried forward", { exact: true }),
  ).toBeVisible();
});

test("WhatsApp summaries use historical tasks without daily notes and regenerate fresh data", async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-21T06:00:00Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  const { tables, task } = await workspace(page);
  tables.daily_work_logs = [];
  task.status = "completed";
  task.completed_at = "2026-10-20T06:00:00Z";
  tables.task_status_history = [
    {
      id: "progress",
      task_id: taskId,
      old_status: "planned",
      new_status: "in_progress",
      assignee_id: devId,
      actor_id: devId,
      detail: {},
      created_at: "2026-10-19T06:00:00Z",
    },
    {
      id: "done",
      task_id: taskId,
      old_status: "in_progress",
      new_status: "completed",
      assignee_id: devId,
      actor_id: devId,
      detail: {},
      created_at: "2026-10-20T06:00:00Z",
    },
  ];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/admin/reports");
  await page.getByLabel("Summary date").fill("2026-10-19");
  await expectValue(
    page.getByLabel("Editable message"),
    /In progress[\s\S]*Verify daily work reporting/,
  );
  await expect(page.getByLabel("Editable message")).not.toHaveValue(/\*Done\*/);
  await selectOption(page.getByLabel("Team", { exact: true }), teamId);
  await selectOption(page.getByLabel("Summary style"), "team");
  await expectValue(page.getByLabel("Editable message"), /\*Test Team\*/);
  await page.getByRole("button", { name: "Copy summary" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Verify daily work reporting",
  );
  await page.getByLabel("Editable message").fill("Temporary manual edit");
  tables.task_status_history.push({
    id: "blocked",
    task_id: taskId,
    old_status: "in_progress",
    new_status: "blocked",
    assignee_id: devId,
    actor_id: devId,
    detail: { blocker: "Waiting for API access" },
    created_at: "2026-10-19T12:00:00Z",
  });
  await page.getByRole("button", { name: "Regenerate preview" }).click();
  await expectValue(
    page.getByLabel("Editable message"),
    /Blocked[\s\S]*Waiting for API access/,
  );
  await expect(page.getByLabel("Editable message")).not.toHaveValue(
    /Temporary manual edit/,
  );
  await page
    .locator(".whatsapp-panel")
    .screenshot({ path: "/private/tmp/syncora-task-summary-mobile.png" });
  await page.getByLabel("Summary date").fill("2026-10-20");
  await expectValue(page.getByLabel("Editable message"), /\*Done\*/);
  await selectOption(page.getByLabel("Developer", { exact: true }), adminId);
  await expectValue(
    page.getByLabel("Editable message"),
    /No task progress available/,
  );
  await page.getByLabel("Summary date").fill("");
  await expect(
    page.getByRole("button", { name: "Copy summary" }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Summary date", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText(/Select a valid summary date|Choose a valid summary date/),
  ).toBeVisible();
});

test("task summary failures are visible and cannot be copied as an empty report", async ({
  page,
}) => {
  await workspace(page);
  await page.route("**/rest/v1/task_status_history?**", (route) =>
    route.fulfill({
      status: 500,
      json: { message: "Task history is temporarily unavailable" },
    }),
  );
  await page.goto("/admin/reports");
  await expect(page.getByRole("alert").first()).toContainText(
    "Task history is temporarily unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Copy summary" }),
  ).toBeDisabled();
});

test("historical task reports use end-date status and exclude earlier completions", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-21T06:00:00Z"));
  const { tables, task } = await workspace(page);
  tables.daily_work_logs = [];
  Object.assign(task, {
    status: "completed",
    completed_at: "2026-10-20T06:00:00Z",
    updated_at: "2026-10-20T06:00:00Z",
  });
  tables.task_status_history = [
    {
      id: "progress",
      task_id: taskId,
      old_status: "planned",
      new_status: "in_progress",
      assignee_id: devId,
      created_at: "2026-10-19T06:00:00Z",
      detail: {},
    },
    {
      id: "done",
      task_id: taskId,
      old_status: "in_progress",
      new_status: "completed",
      assignee_id: devId,
      created_at: "2026-10-20T06:00:00Z",
      detail: {},
    },
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/reports");
  await page.getByLabel("End date", { exact: true }).fill("2026-10-19");
  await expect(
    page.getByRole("cell", { name: "In progress", exact: true }),
  ).toBeVisible();
  await page.getByLabel("End date", { exact: true }).fill("2026-10-20");
  await expect(
    page.getByRole("cell", { name: "Done", exact: true }),
  ).toBeVisible();
  await page.getByLabel("End date", { exact: true }).fill("2026-10-21");
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-21");
  await expect(
    page.getByRole("heading", { name: "No tasks match this report" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("developers can choose multiple projects and switching teams clears project context", async ({
  page,
}) => {
  const { tables } = await workspace(page, "developer");
  const secondTeam = "00000000-0000-4000-8000-000000000011";
  const projectA = "00000000-0000-4000-8000-000000000051";
  const projectB = "00000000-0000-4000-8000-000000000052";
  const projectC = "00000000-0000-4000-8000-000000000053";
  tables.teams.push({ id: secondTeam, name: "Second Team", archived: false });
  tables.projects = [
    { id: projectA, name: "Client Portal", archived: false },
    { id: projectB, name: "Delivery Platform", archived: false },
    { id: projectC, name: "Other Team Project", archived: false },
  ];
  tables.project_memberships = [
    { id: "scope-a", project_id: projectA, team_id: teamId },
    { id: "scope-b", project_id: projectB, team_id: teamId },
    { id: "scope-c", project_id: projectC, team_id: secondTeam },
  ];
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add my task", exact: true }).click();
  await selectOption(page.getByLabel("Team", { exact: true }), teamId);
  const project = page.getByLabel("Project", { exact: true });
  await expectOptions(project, [
    "No project",
    "Client Portal",
    "Delivery Platform",
  ]);
  await selectOption(project, projectA);
  await selectOption(project, projectB);
  await page.getByLabel("Task title").fill("Work on delivery platform");
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") && r.postDataJSON()?.action === "task",
  );
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  expect((await request).postDataJSON().payload.project_id).toBe(projectB);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add my task", exact: true }).click();
  await selectOption(page.getByLabel("Team", { exact: true }), teamId);
  await selectOption(project, projectA);
  await selectOption(page.getByLabel("Team", { exact: true }), secondTeam);
  await expectValue(project, "");
  await expectOptions(project, ["No project", "Other Team Project"]);
});

test("team editing opens member controls with the current member and team preselected", async ({
  page,
}) => {
  await workspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/teams");
  await page
    .getByRole("button", { name: "Edit Test Team", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Manage team", exact: true });
  await expectValue(
    editor.getByLabel("Team name", { exact: true }),
    "Test Team",
  );
  await editor.getByRole("tab", { name: "Members", exact: true }).click();
  await editor
    .getByRole("button", { name: "Edit member", exact: true })
    .click();
  const membership = editor;
  await expectValue(
    membership.getByLabel("Team member", { exact: true }),
    devId,
  );
  await expectValue(membership.getByLabel("Team", { exact: true }), teamId);
  await selectOption(membership.getByLabel("Team", { exact: true }), "");
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") &&
      r.postDataJSON()?.action === "membership",
  );
  await membership.getByRole("button", { name: "Save membership" }).click();
  expect((await request).postDataJSON().payload).toMatchObject({
    developer_id: devId,
    team_id: null,
    is_lead: false,
  });
  await expect(editor.getByLabel("Team member", { exact: true })).toHaveCount(
    0,
  );
  await editor.getByRole("button", { name: "Add member", exact: true }).click();
  const addMember = page.getByRole("dialog", {
    name: "Add team member",
    exact: true,
  });
  await expect(addMember).toContainText("Test Team");
  await expectValue(addMember.getByLabel("Team member", { exact: true }), "");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("forms show accessible inline validation and block invalid save requests", async ({
  page,
}) => {
  await workspace(page);
  const saves: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rpc/command")) saves.push(r.postData() || "");
  });
  await page.goto("/admin/teams");
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(page.getByText("Enter a name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Name", { exact: true }).fill("Valid team");
  await expect(page.getByText("Enter a name", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage membership", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save membership", exact: true })
    .click();
  await expect(
    page.getByText("Select a team member", { exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await page.getByLabel("Name", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Enter a name", { exact: true })).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Add holiday", exact: true }).click();
  await expect(page.getByText("Enter a name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add type", exact: true }).click();
  await expect(
    page.getByLabel("New leave type", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("Allowed email domains (comma separated)")
    .fill("https://example.com");
  await page
    .getByRole("button", { name: "Save calendar", exact: true })
    .click();
  await expect(
    page.getByText(/Enter valid domains separated by commas/),
  ).toBeVisible();
  await page.goto("/admin/integrations");
  await page.getByLabel("Enable Google Sheets synchronization").check();
  await page
    .getByRole("button", { name: "Save configuration", exact: true })
    .click();
  await expect(
    page.getByText("Enter a spreadsheet ID to enable synchronization", {
      exact: true,
    }),
  ).toBeVisible();
  expect(saves).toEqual([]);
});

test("task details and calendar display inline errors without sending invalid commands", async ({
  page,
}) => {
  await workspace(page);
  const saves: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rpc/command")) saves.push(r.postData() || "");
  });
  await page.goto("/admin/tasks");
  await page
    .getByRole("button", { name: "Verify daily work reporting", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add contributor", exact: true })
    .click();
  await expect(
    page.getByText("Select a contributor", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByText("Enter a comment", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/settings");
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"])
    await page.getByLabel(day, { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save calendar", exact: true })
    .click();
  await expect(
    page.getByText("Select at least one working day", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mon", { exact: true }).check();
  await expect(
    page.getByText("Select at least one working day", { exact: true }),
  ).toHaveCount(0);
  expect(saves).toEqual([]);
});

test("Blissora design uses shadcn cards and a responsive task detail sheet", async ({
  page,
}) => {
  const { task, tables } = await workspace(page, "developer");
  const previewProjects = [
    "Client Portal",
    "Delivery Platform",
    "Design System",
    "Developer Experience",
  ].map((name, i) => ({
    id: `00000000-0000-4000-8000-00000000005${i}`,
    name,
    archived: false,
  }));
  tables.projects = previewProjects;
  task.project_id = previewProjects[0].id;
  task.title = "Improve client portal search";
  task.target_date = date;
  for (const [i, [title, status, description]] of [
    [
      "Add team project filters",
      "planned",
      "Make project selection clear for developers working across teams.",
    ],
    [
      "Review account approval flow",
      "planned",
      "Review labels and field validation before the next release.",
    ],
    [
      "Refine mobile task cards",
      "in_progress",
      "Check touch controls and card layouts on smaller screens.",
    ],
    [
      "Document release checklist",
      "completed",
      "Record the final deployment and verification steps.",
    ],
    [
      "Fix membership validation",
      "completed",
      "Preserve historical teams when moving a developer.",
    ],
  ].entries())
    tables.tasks.push({
      ...task,
      id: `00000000-0000-4000-8000-00000000008${i}`,
      task_number: i + 2,
      project_id: previewProjects[(i + 1) % previewProjects.length].id,
      priority: ["low", "medium", "high", "urgent"][i % 4],
      title,
      status,
      description,
      completed_at: status === "completed" ? now : null,
    });
  task.description =
    "Improve the client portal search, including filters, empty states and keyboard navigation.";
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  await expect(page.locator('[data-slot="card"].task-row')).toHaveCount(6);
  await expect(
    page.locator('[data-slot="card"].task-row').first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "SyncOra", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".project-tag")).toHaveCount(6);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/design-board-light.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Improve client portal search", exact: true })
    .click();
  await expect(page.locator('[data-slot="sheet-content"]')).toBeVisible();
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Comments", exact: true }).click();
  await expect(page.getByLabel("Add a comment", { exact: true })).toBeVisible();
  await page.screenshot({ path: "docs/design-task-sheet.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Use dark theme", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: "docs/design-board-dark.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Improve client portal search", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.locator('[data-slot="sheet-content"]').boundingBox())?.x,
    )
    .toBe(8);
  expect(
    (await page.locator('[data-slot="sheet-content"]').boundingBox())?.width,
  ).toBe(374);
  await page.screenshot({
    path: "docs/design-mobile-sheet.png",
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("membership history and report snapshots use accessible shadcn collapsibles", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/admin/teams");
  await page
    .getByRole("button", { name: "Edit Test Team", exact: true })
    .click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  const membership = page.getByRole("button", { name: /Membership history/ });
  await expect(membership).toHaveAttribute("aria-expanded", "true");
  await membership.click();
  await expect(membership).toHaveAttribute("aria-expanded", "false");
  await page.goto("/admin/reports");
  const snapshots = page.getByRole("button", {
    name: /Saved snapshots for this date/,
  });
  await expect(snapshots).toHaveAttribute("aria-expanded", "false");
  await snapshots.click();
  await expect(snapshots).toHaveAttribute("aria-expanded", "true");
});

test("task register selects tasks inline and shows bulk actions only when needed", async ({
  page,
}) => {
  const { tables, task } = await workspace(page);
  tables.tasks.push({
    ...task,
    id: "00000000-0000-4000-8000-000000000021",
    task_number: 2,
    title: "Review project filters",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/tasks");
  await expect(
    page.getByRole("region", { name: "Selected task actions" }),
  ).toHaveCount(0);
  await expect(page.locator(".selection-list")).toHaveCount(0);
  await expect(page.locator(".register-list .task-row")).toHaveCount(2);
  await page.screenshot({
    path: "docs/design-task-register.png",
    fullPage: true,
  });
  await page
    .getByRole("checkbox", {
      name: "Select SYNC-1: Verify daily work reporting",
      exact: true,
    })
    .check();
  await expect(
    page.getByRole("region", { name: "Selected task actions" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 selected");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Selected task actions" }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Select all tasks on this page",
      exact: true,
    })
    .check();
  await expect(page.getByRole("status")).toContainText("2 selected");
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") &&
      r.postDataJSON()?.action === "bulk_tasks",
  );
  await page.getByRole("button", { name: "Apply status", exact: true }).click();
  expect((await request).postDataJSON().payload.tasks).toHaveLength(2);
  await expect(
    page.getByRole("region", { name: "Selected task actions" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("checkbox", {
      name: "Select SYNC-1: Verify daily work reporting",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/design-task-register-mobile.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("only task card outlines are removed while form field borders remain", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/admin/morning-standup");
  await expect(
    page.locator('.task-list [data-slot="card"].task-row').first(),
  ).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".meeting-person")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".nav-link.active")).toHaveCSS(
    "box-shadow",
    "none",
  );
  await expect(page.getByLabel("Meeting date", { exact: true })).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await page
    .getByRole("button", { name: "Verify daily work reporting", exact: true })
    .click();
  await expect(page.getByLabel("Add a comment", { exact: true })).toHaveCSS(
    "border-top-width",
    "1px",
  );
});

test("workspace motion settles and respects reduced motion", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/admin/tasks");
  await expect(
    page.locator(".nav-link.active .nav-active-surface"),
  ).toBeVisible();
  await expect(page.locator(".page-heading")).toHaveCSS("transform", "none");
  await page
    .getByRole("link", { name: "Morning standup", exact: true })
    .click();
  await expect(page.locator(".nav-link.active")).toContainText(
    "Morning standup",
  );
  await expect(page.locator(".nav-active-surface")).toHaveCount(1);
  await expect(page.locator(".page-heading")).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("link", { name: "Task register", exact: true }).click();
  await expect(page.locator(".page-heading")).toHaveCSS("transform", "none");
  await expect(page.locator(".nav-active-surface")).toHaveCSS(
    "transform",
    "none",
  );
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`dragged task follows the pointer within one frame (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await workspace(page, "developer");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard");
    const handle = page.getByRole("button", { name: /^Move SYNC-1\./ });
    const origin = (await handle.boundingBox())!;
    const card = (await page
      .locator('[data-task-key="SYNC-1"]')
      .boundingBox())!;
    const start = {
      x: origin.x + origin.width / 2,
      y: origin.y + origin.height / 2,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const delta of [20, 100, 240]) {
      await page.mouse.move(start.x + delta, start.y + 35);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const moved = (await page.locator(".task-drag-overlay").boundingBox())!;
      expect(Math.abs(moved.x - (card.x + delta))).toBeLessThan(3);
      expect(Math.abs(moved.y - (card.y + 35))).toBeLessThan(3);
    }
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
}

test("dropping a task updates its column before the server responds", async ({
  page,
}) => {
  await workspace(page, "developer");
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/rpc/command", async (route) => {
    await response;
    await route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  const handle = page.getByRole("button", { name: /^Move SYNC-1\./ });
  const origin = (await handle.boundingBox())!;
  const column = page.getByRole("region", { name: "To do tasks", exact: true });
  const target = (await column.boundingBox())!;
  try {
    await page.mouse.move(
      origin.x + origin.width / 2,
      origin.y + origin.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 15 },
    );
    const landing = page.locator(".task-drag-overlay").evaluate(
      (overlay) =>
        new Promise<{
          x: number;
          y: number;
          targetX: number;
          targetY: number;
          duration: number;
        }>((resolve) => {
          const observer = new MutationObserver(() => {
            if (!overlay.hasAttribute("data-dnd-dropping")) return;
            const animation = overlay.getAnimations()[0];
            if (!(animation?.effect instanceof KeyframeEffect)) return;
            const end = animation.effect.getKeyframes().at(-1)!;
            const [x, y] = String(end.translate).split(/\s+/).map(parseFloat);
            const style = getComputedStyle(overlay);
            const target = document
              .querySelector('[data-task-key="SYNC-1"]')!
              .getBoundingClientRect();
            observer.disconnect();
            resolve({
              x: parseFloat(style.left) + x,
              y: parseFloat(style.top) + y,
              targetX: target.x,
              targetY: target.y,
              duration: Number(animation.effect.getTiming().duration),
            });
          });
          observer.observe(overlay, {
            attributes: true,
            attributeFilter: ["data-dnd-dropping"],
          });
        }),
    );
    await page.mouse.up();
    const end = await landing;
    expect(Math.abs(end.x - end.targetX)).toBeLessThan(3);
    expect(Math.abs(end.y - end.targetY)).toBeLessThan(3);
    expect(end.duration).toBe(180);
    await expect(column).toContainText("Verify daily work reporting", {
      timeout: 500,
    });
    await expectValue(page.getByLabel("Status for SYNC-1"), "planned");
    await expect(page.locator(".board-feedback")).toHaveText("Moving task…");
  } finally {
    release();
  }
  await expect(page.locator(".board-feedback")).toHaveText(
    "SYNC-1 moved to To do.",
  );
});

test("task drawer groups details and displays a chronological status timeline", async ({
  page,
}) => {
  const { task, tables } = await workspace(page, "developer");
  task.description =
    "Improve the task board with clear project filters and accessible status updates.";
  tables.task_status_history = [
    {
      id: "history-old",
      task_id: taskId,
      actor_id: devId,
      old_status: null,
      new_status: "planned",
      created_at: "2026-10-18T03:30:00Z",
    },
    {
      id: "history-new",
      task_id: taskId,
      actor_id: devId,
      old_status: "in_progress",
      new_status: "completed",
      created_at: "2026-10-20T10:45:00Z",
    },
    {
      id: "history-middle",
      task_id: taskId,
      actor_id: adminId,
      old_status: "planned",
      new_status: "in_progress",
      created_at: "2026-10-19T04:00:00Z",
    },
  ];
  tables.task_comments = [
    {
      id: "comment-one",
      task_id: taskId,
      author_id: devId,
      body: "Project filters are ready for review.",
      created_at: "2026-10-20T09:00:00Z",
    },
  ];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Use dark theme" }).click();
    await page
      .getByRole("button", { name: "Verify daily work reporting", exact: true })
      .click();
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(
      drawer.getByRole("region", { name: "Task overview" }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("heading", { name: "Description", exact: true }),
    ).toBeVisible();
    await expect(drawer.locator(".task-comment time")).toHaveAttribute(
      "datetime",
      "2026-10-20T09:00:00Z",
    );
    await drawer.getByRole("tab", { name: "Activity", exact: true }).click();
    const events = drawer.locator(".task-timeline-event");
    await expect(events).toHaveCount(3);
    await expect(events.first()).toContainText("In progress");
    await expect(events.first()).toContainText("Done");
    await expect(events.first().locator("time")).toContainText("16:15");
    await expect(events.last()).toContainText("created the task");
    await expect(events.last().locator("time")).toHaveAttribute(
      "datetime",
      "2026-10-18T03:30:00Z",
    );
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await events.last().scrollIntoViewIfNeeded();
      expect(
        await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/task-timeline-${theme}-${width}.png`,
        });
    }
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});

test("developer calendar reconstructs past days, counts workdays and stays usable across themes and sizes", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  const { task, tables } = await workspace(page, "developer");
  task.title = "Carry project filters forward";
  task.created_at = "2026-10-16T06:00:00Z";
  task.updated_at = "2026-10-16T07:00:00Z";
  const done = {
    ...task,
    id: "done-task",
    task_number: 2,
    title: "Release completed yesterday",
    status: "completed",
    completed_at: "2026-10-19T10:00:00Z",
    updated_at: "2026-10-19T10:00:00Z",
  };
  tables.tasks = [task, done];
  tables.task_status_history = [task, done].flatMap((t) => [
    {
      id: `${t.id}-create`,
      task_id: t.id,
      old_status: null,
      new_status: "planned",
      assignee_id: devId,
      created_at: "2026-10-16T06:00:00Z",
    },
    {
      id: `${t.id}-start`,
      task_id: t.id,
      old_status: "planned",
      new_status: "in_progress",
      assignee_id: devId,
      created_at: "2026-10-16T07:00:00Z",
    },
    ...(t.id === "done-task"
      ? [
          {
            id: "done-event",
            task_id: t.id,
            old_status: "in_progress",
            new_status: "completed",
            assignee_id: devId,
            created_at: "2026-10-19T10:00:00Z",
          },
        ]
      : []),
  ]);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Today’s tasks", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3 workdays in progress", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Release completed yesterday", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/my-tasks");
  await expect(
    page.getByRole("heading", { name: "My tasks", exact: true }),
  ).toBeVisible();
  const agenda = page.locator(".task-calendar-agenda");
  const pastDay = page.getByRole("button", {
    name: "19 Oct 2026, 2 tasks",
    exact: true,
  });
  await pastDay.focus();
  await pastDay.press("Enter");
  await expect(agenda).toContainText("Release completed yesterday");
  await expect(
    agenda.getByText("2 workdays in progress", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByLabel(/^Status for SYNC/)).toHaveCount(0);
  await agenda.getByRole("button", { name: "Close", exact: true }).click();
  const todayButton = page.getByRole("button", {
    name: "20 Oct 2026, 1 task",
    exact: true,
  });
  const todayBounds = (await todayButton.boundingBox())!;
  const weekBounds = await todayButton.evaluate((el) =>
    el.closest(".rbc-month-row")!.getBoundingClientRect().toJSON(),
  );
  await page.mouse.click(
    todayBounds.x + todayBounds.width / 2,
    weekBounds.bottom - 4,
  );
  await expect(
    agenda.getByText("Release completed yesterday", { exact: true }),
  ).toHaveCount(0);
  await expect(agenda).toContainText("3 workdays in progress");
  await page
    .getByRole("button", { name: "Carry project filters forward", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Current task details");
  await page.keyboard.press("Escape");
  await expect(agenda).toBeVisible();
  await agenda.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Carry project filters forward · 16 Oct 2026",
      exact: true,
    })
    .click();
  await expect(
    agenda.getByRole("heading", { name: "Tasks · 16 Oct 2026", exact: true }),
  ).toBeVisible();
  await agenda.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Task calendar month").fill("2026-09");
  await expect(
    page.getByRole("heading", { name: "September 2026", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "01 Sep 2026, 0 tasks", exact: true })
    .click();
  await expect(agenda).toContainText("No tasks for this day");
  await agenda.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Use dark theme" }).click();
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await expect(page.locator(".rbc-month-view")).toBeVisible();
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/task-calendar-${theme}-${width}.png`,
          fullPage: true,
        });
      await page
        .getByRole("button", { name: "20 Oct 2026, 1 task", exact: true })
        .click();
      await expect(agenda).toBeVisible();
      await expect
        .poll(async () => {
          const bounds = (await agenda.boundingBox())!;
          return Math.abs(
            bounds.y + bounds.height - (1000 - (width < 600 ? 8 : 12)),
          );
        })
        .toBeLessThan(2);
      const fullWidth = (await agenda.boundingBox())!;
      expect(fullWidth.x).toBe(width < 600 ? 8 : 12);
      expect(fullWidth.width).toBe(width - (width < 600 ? 16 : 24));
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/task-calendar-bottom-sheet-${theme}-${width}.png`,
          fullPage: false,
        });
      await agenda.getByRole("button", { name: "Close", exact: true }).click();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});

test("today's board rolls over at Colombo midnight without duplicating unfinished tasks", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T18:28:00Z") });
  const { task, tables } = await workspace(page, "developer");
  tables.tasks = [
    task,
    {
      ...task,
      id: "midnight-done",
      task_number: 2,
      title: "Finished before midnight",
      status: "completed",
      completed_at: "2026-10-20T10:00:00Z",
    },
  ];
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Done tasks", exact: true }),
  ).toContainText("Finished before midnight");
  await page.clock.pauseAt(new Date("2026-10-20T18:29:55Z"));
  await page.clock.runFor(5100);
  await page.clock.resume();
  await expect(
    page.getByText("Finished before midnight", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Verify daily work reporting",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.locator(".page-heading")).toContainText("21 Oct 2026");
  expect(tables.tasks).toHaveLength(2);
});

test("calendar show-more opens a scrollable bottom sheet and restores focus", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  const { task, tables } = await workspace(page, "developer");
  tables.tasks = Array.from({ length: 8 }, (_, i) => ({
    ...task,
    id: `calendar-${i}`,
    task_number: i + 10,
    title: `Review delivery milestone ${i + 1}`,
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/my-tasks");
  const more = page.locator(".rbc-show-more").first();
  await expect(more).toBeVisible();
  await more.focus();
  await more.press("Enter");
  const sheet = page.locator(".day-task-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".task-calendar-record")).toHaveCount(8);
  await sheet.locator(".task-calendar-record").last().scrollIntoViewIfNeeded();
  await expect(
    sheet.getByRole("button", { name: "Close", exact: true }),
  ).toBeVisible();
  expect(
    await sheet
      .locator(".day-task-sheet-body")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!document.activeElement?.matches(
            ".rbc-show-more, .calendar-date-button",
          ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "21 Oct 2026, 8 tasks", exact: true }),
  ).toBeEnabled();
});

test("Hairline login responds to keyboard, bounds its intro and fits mobile themes", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/login");
  const figure = page.locator('.auth-story [data-hairline="riffle"]');
  const rightFigure = page.locator(
    '.auth-signin-region [data-hairline="relay"]',
  );
  await expect(rightFigure).toBeVisible();
  await expect(
    page.getByRole("button", { name: /illustration animation/ }),
  ).toHaveCount(0);
  await expect(page.locator("figcaption")).toHaveCount(0);
  await expect(figure).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeEnabled();
  const geometry = () =>
    figure
      .locator("svg path")
      .evaluateAll((paths) =>
        paths.map((path) => path.getAttribute("d")).join("|"),
      );
  const initial = await geometry();
  await expect.poll(geometry).not.toBe(initial);
  await page.clock.fastForward(8200);
  await page.clock.fastForward(2000);
  const settled = await geometry();
  await page.clock.fastForward(1000);
  expect(await geometry()).toBe(settled);
  await rightFigure.focus();
  await rightFigure.press("ArrowRight");
  await expect(
    page.locator(".auth-signin-illustration [aria-live]"),
  ).not.toHaveText("rest");
  const relayGeometry = () =>
    rightFigure
      .locator("svg path")
      .evaluateAll((paths) =>
        paths.map((path) => path.getAttribute("d")).join("|"),
      );
  const relayPose = await relayGeometry();
  await rightFigure.press("ArrowLeft");
  await expect.poll(relayGeometry).not.toBe(relayPose);
  const panel = page.locator(".auth-panel");
  expect((await rightFigure.boundingBox())!.y).toBeGreaterThan(
    (await panel.boundingBox())!.y + (await panel.boundingBox())!.height,
  );

  const rest = await geometry();
  await figure.focus();
  await figure.press("ArrowRight");
  await expect.poll(geometry).not.toBe(rest);
  await expect(figure.locator("[data-hairline-live]")).not.toHaveText("rest");
  const bounds = (await figure.boundingBox())!;
  await page.mouse.move(
    bounds.x + (bounds.width * 128) / 400,
    bounds.y + (bounds.height * 150) / 320,
  );
  await expect(figure.locator("[data-hairline-live]")).not.toHaveText("rest");
  await page.mouse.move(0, 0);
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .focus();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/login-hairline-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(100);
  await page.clock.fastForward(2000);
  const reduced = await geometry();
  await page.clock.fastForward(2000);
  expect(await geometry()).toBe(reduced);
  const reducedRelay = await relayGeometry();
  await page.clock.fastForward(2000);
  expect(await relayGeometry()).toBe(reducedRelay);
});

test("team overview organizes workload, filters developers and surfaces blockers", async ({
  page,
}) => {
  const { tables, task } = await workspace(page);
  const secondDev = "00000000-0000-4000-8000-000000000003";
  const thirdDev = "00000000-0000-4000-8000-000000000004";
  const secondTeam = "00000000-0000-4000-8000-000000000011";
  const developer = tables.profiles[1] as Record<string, unknown>;
  tables.profiles.push(
    { ...developer, id: secondDev, name: "Alex Rivera" },
    { ...developer, id: thirdDev, name: "Sam Taylor" },
  );
  tables.teams.push({
    id: secondTeam,
    name: "Platform Engineering",
    archived: false,
    created_at: now,
    updated_at: now,
  });
  tables.team_memberships.push({
    id: "second-membership",
    developer_id: secondDev,
    team_id: secondTeam,
    starts_on: "2020-01-01",
    ends_on: null,
    is_lead: false,
  });
  tables.tasks.push(
    {
      ...task,
      id: "blocked-task",
      task_number: 2,
      title: "Restore staging deployment",
      status: "blocked",
      assignee_id: secondDev,
      team_id: secondTeam,
      blocker: "Waiting for staging access",
    },
    {
      ...task,
      id: "finished-task",
      task_number: 3,
      title: "Completed historical task",
      status: "completed",
    },
  );
  await page.goto("/admin/dashboard");
  await expect(
    page.getByRole("heading", { name: "Developer workload" }),
  ).toBeVisible();
  const roster = page.locator(".overview-roster");
  const rows = roster.locator(".overview-person-trigger");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Alex Rivera");
  await expect(page.locator(".overview-blocker")).toContainText(
    "Waiting for staging access",
  );
  await expect(
    page
      .locator(".team-overview .metric")
      .filter({ hasText: "Active developers" }),
  ).toContainText("3");
  await expect(
    page.getByText("Completed historical task", { exact: true }),
  ).toHaveCount(0);
  await rows.first().click();
  await expect(
    roster.getByText("Restore staging deployment", { exact: true }),
  ).toBeVisible();
  await rows.first().click();
  await expect(
    roster.getByText("Restore staging deployment", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search developers").fill("no match");
  await expect(
    page.getByRole("heading", { name: "No matching developers" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await selectOption(page.getByLabel("Developer team"), secondTeam);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Alex Rivera");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await roster.getByRole("button", { name: /Sam Taylor/ }).click();
  await expect(roster.getByText("No open tasks assigned.")).toBeVisible();
  await roster.getByRole("button", { name: /Sam Taylor/ }).click();
  await rows.first().click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme} ${width}px`,
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/team-overview-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await expect(
    page.getByRole("link", { name: "Open task register", exact: true }),
  ).toHaveAttribute("href", "/admin/tasks");
  for (const team of tables.teams)
    (team as { archived: boolean }).archived = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No active teams", exact: true }),
  ).toBeVisible();
});

test("signed-in Google avatars render in navigation and profile with initials fallback", async ({
  browser,
  baseURL,
}) => {
  const photo = "https://lh3.googleusercontent.com/syncora-test-avatar";
  for (const scenario of [
    { metadata: { avatar_url: photo }, image: true },
    { metadata: { picture: photo }, image: true },
    {
      metadata: { avatar_url: "http://invalid.test/photo", picture: photo },
      image: true,
    },
    { metadata: {}, image: false },
    { metadata: { avatar_url: `${photo}/missing` }, image: false },
  ]) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await workspace(page, "developer", "active", scenario.metadata);
      await page.route(`${photo}**`, (route) =>
        route.request().url().endsWith("missing")
          ? route.abort()
          : route.fulfill({
              status: 200,
              contentType: "image/png",
              body: Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKH0AAAAASUVORK5CYII=",
                "base64",
              ),
            }),
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/profile");
      await expect(
        page.getByRole("heading", { name: "My profile", exact: true }),
      ).toBeVisible();
      for (const selector of [".user-card", ".profile-identity"]) {
        const avatar = page.locator(`${selector} [data-slot="avatar"]`);
        if (scenario.image) {
          await expect(avatar.locator("img")).toBeVisible();
          await expect(avatar.locator("img")).toHaveAttribute("src", photo);
          await expect(avatar.locator("img")).toHaveAttribute(
            "referrerpolicy",
            "no-referrer",
          );
        } else {
          await expect(
            avatar.locator("[data-slot=avatar-fallback]"),
          ).toHaveText("TD");
          await expect(avatar.locator("img")).toHaveCount(0);
        }
      }
      if ("picture" in scenario.metadata) {
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);
          for (const width of [1440, 390, 360]) {
            await page.setViewportSize({ width, height: 900 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
            if (width !== 360)
              await page.screenshot({
                path: `docs/google-profile-${theme}-${width}.png`,
                fullPage: true,
              });
          }
        }
      }
    } finally {
      await context.close();
    }
  }
});

test("reports paginate rows while exports and totals include the full result", async ({
  page,
}) => {
  const { tables, task } = await workspace(page);
  tables.tasks = Array.from({ length: 58 }, (_, i) => ({
    ...task,
    id: `report-task-${i}`,
    task_number: i + 1,
    title: `Report task ${String(i + 1).padStart(2, "0")}`,
    status: i < 50 ? "in_progress" : "blocked",
  }));
  await page.goto("/admin/reports");
  const report = page.getByRole("region", {
    name: "Work report, scroll for more columns",
    exact: true,
  });
  const pager = page.getByRole("navigation", {
    name: "Report pagination",
    exact: true,
  });
  await expectValue(page.getByLabel("Rows per page", { exact: true }), "10");
  await expect(report.locator("tbody tr")).toHaveCount(10);
  await expect(pager).toContainText("Showing 1–10 of 58 tasks");
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager).toContainText("Page 2 of 6");
  await selectOption(page.getByLabel("Rows per page", { exact: true }), "25");
  await expect(pager).toContainText("Page 1 of 3");
  await expect(report.locator("tbody tr")).toHaveCount(25);
  await expect(pager).toContainText("Showing 1–25 of 58 tasks");
  await expect(
    pager.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager).toContainText("Page 2 of 3");
  await expect(
    report.getByRole("cell", { name: "Report task 26", exact: true }),
  ).toBeVisible();
  await expect(
    report.getByRole("cell", { name: "Report task 01", exact: true }),
  ).toHaveCount(0);
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager).toContainText("Showing 51–58 of 58 tasks");
  await expect(report.locator("tbody tr")).toHaveCount(8);
  await expect(
    pager.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".metric")
      .filter({ has: page.getByText("Tasks", { exact: true }) }),
  ).toContainText("58");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const stream = await (await download).createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain("Report task 01");
  expect(csv).toContain("Report task 58");
  expect(csv.trim().split(/\r?\n/)).toHaveLength(59);
  await selectOption(page.getByLabel("Rows per page", { exact: true }), "50");
  await expect(pager).toContainText("Page 1 of 2");
  await expect(report.locator("tbody tr")).toHaveCount(50);
  await selectOption(page.getByLabel("Rows per page", { exact: true }), "100");
  await expect(report.locator("tbody tr")).toHaveCount(58);
  await expect(
    pager.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await selectOption(page.getByLabel("Rows per page", { exact: true }), "25");

  await selectOption(
    page.getByLabel("Task status", { exact: true }),
    "blocked",
  );
  await expect(pager).toContainText("Page 1 of 1");
  await expect(report.locator("tbody tr")).toHaveCount(8);
  await selectOption(page.getByLabel("Task status", { exact: true }), "");
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill("2026-01-01");
  await expect(pager).toContainText("Page 1 of 3");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await pager
        .getByRole("button", { name: "Next", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        pager.getByRole("button", { name: "Next", exact: true }),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width !== 360)
        await page.screenshot({
          path: `docs/report-pagination-${theme}-${width}.png`,
        });
    }
  }
  tables.tasks = tables.tasks.slice(0, 50);
  await page.reload();
  await selectOption(page.getByLabel("Rows per page", { exact: true }), "25");
  await expect(pager).toContainText("Page 1 of 2");
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(report.locator("tbody tr")).toHaveCount(25);
  await expect(
    pager.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await selectOption(
    page.getByLabel("Task status", { exact: true }),
    "completed",
  );
  await expect(
    page.getByRole("heading", {
      name: "No tasks match this report",
      exact: true,
    }),
  ).toBeVisible();
  await expect(pager).toHaveCount(0);
});

test("teams show searchable memberships, Google avatars and concurrent project access", async ({
  page,
}) => {
  const { tables } = await workspace(page);
  const second = "00000000-0000-4000-8000-000000000003";
  const photo = "https://lh3.googleusercontent.com/team-avatar-test";
  const dev = tables.profiles[1] as Record<string, unknown>;
  dev.avatar_url = photo;
  tables.profiles.push({ ...dev, id: second, name: "Second Developer" });
  tables.team_memberships.push({
    id: "second-member",
    developer_id: second,
    team_id: teamId,
    starts_on: "2020-01-01",
    ends_on: null,
    is_lead: false,
  });
  tables.teams.push({
    id: "archived-team",
    name: "Archived Team",
    archived: true,
  });
  tables.projects = [
    { id: "project-1", name: "Client Portal", archived: false },
    { id: "project-2", name: "Delivery Platform", archived: false },
  ];
  tables.project_memberships = [
    { id: "access-1", team_id: teamId, project_id: "project-1" },
    { id: "access-2", team_id: teamId, project_id: "project-2" },
  ];
  await page.route(photo, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKH0AAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/admin/teams");
  const card = page.locator(".team-grid > .panel").filter({
    has: page.getByRole("heading", { name: "Test Team", exact: true }),
  });
  await expect(card).toContainText("2 members");
  await expect(card.getByText("Client Portal", { exact: true })).toBeVisible();
  await expect(
    card.getByText("Delivery Platform", { exact: true }),
  ).toBeVisible();
  await expect(card.locator('[data-slot="avatar-image"]')).toHaveCount(2);
  await page.getByLabel("Search teams or members").fill("Second Developer");
  await expect(card).toBeVisible();
  await page.getByLabel("Search teams or members").fill("missing member");
  await expect(
    page.getByRole("heading", {
      name: "No teams match your filters",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  const visibility = page.getByLabel("Team visibility", { exact: true });
  await visibility.fill("archived");
  await page
    .getByRole("option", { name: "Archived teams", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Archived Team", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/teams-react-select-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page
    .getByRole("button", { name: "Manage membership", exact: true })
    .click();
  const member = page
    .getByRole("dialog")
    .getByLabel("Team member", { exact: true });
  await member.fill("second");
  await page
    .getByRole("option")
    .filter({ hasText: "Second Developer" })
    .click();
  await expectValue(member, second);
  await member.click();
  await member.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("unfinished tasks carry into tomorrow and the next month without recording future work", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  const { task, tables } = await workspace(page, "developer");
  tables.tasks = [
    { ...task, status: "in_progress" },
    {
      ...task,
      id: "finished",
      task_number: 999,
      title: "Already finished",
      status: "completed",
      completed_at: "2026-10-20T06:00:00Z",
    },
  ];
  await page.goto("/my-tasks");
  await page
    .getByRole("button", { name: "21 Oct 2026, 1 task", exact: true })
    .click();
  const sheet = page.locator(".day-task-sheet");
  await expect(sheet).toContainText("Planned carry-forward");
  await expect(sheet).toContainText(task.title);
  await expect(sheet).not.toContainText("Already finished");
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page
    .getByRole("button", { name: "02 Nov 2026, 1 task", exact: true })
    .click();
  await expect(sheet).toContainText(task.title);
  expect(tables.tasks).toHaveLength(2);
  expect(tables.tasks[0]).toMatchObject({ created_at: task.created_at });
});

test("modal dropdown menus stay anchored, clickable and color-coded", async ({
  page,
}) => {
  await workspace(page, "developer");
  await page.goto("/dashboard");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole("button", { name: "Add my task", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      for (const label of ["Team", "Project", "Status"]) {
        const control = dialog.getByLabel(label, { exact: true });
        await control.click();
        const menu = dialog.locator(".app-select__menu");
        await expect(menu).toBeVisible();
        const field = await control
          .locator("xpath=ancestor::div[contains(@class,'app-select-wrapper')]")
          .boundingBox();
        const bounds = await menu.boundingBox();
        expect(Math.abs(bounds!.x - field!.x)).toBeLessThan(3);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(901);
        const first = menu.getByRole("option").first();
        await expect(first).toBeInViewport();
        await first.click();
        await expect(menu).toHaveCount(0);
      }
      await selectOption(
        dialog.getByLabel("Status", { exact: true }),
        "in_progress",
      );
      await expect(
        dialog.locator(".app-select__single-value .badge-in_progress"),
      ).toBeVisible();
      await dialog.getByLabel("Status", { exact: true }).click();
      await expect(
        dialog.getByRole("option").locator(".badge-planned"),
      ).toBeVisible();
      await expect(
        dialog.getByRole("option").locator(".badge-completed"),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/modal-dropdown-${theme}-${width}.png`,
      });
      await dialog
        .getByRole("option")
        .filter({ has: page.locator('[data-select-value="completed"]') })
        .click();
      await expect(
        dialog.locator(".app-select__single-value .badge-completed"),
      ).toBeVisible();
      await dialog.getByLabel("Status", { exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }
  }
});

test("task cards place a dedicated status picker at the top right", async ({
  page,
}) => {
  await workspace(page, "developer");
  await page.goto("/dashboard");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const picker = page.getByLabel("Status for SYNC-1");
      const card = picker.locator('xpath=ancestor::*[@data-slot="card"][1]');
      const bounds = await card.boundingBox();
      const statusBounds = await picker.boundingBox();
      expect(statusBounds!.y - bounds!.y).toBeLessThan(80);
      await picker
        .locator('xpath=ancestor::div[@data-slot="native-select-wrapper"]')
        .locator(".app-select__control")
        .click();
      await expect(
        page.getByRole("option").filter({ hasText: "Working on this now" }),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/task-status-picker-${theme}-${width}.png`,
        fullPage: false,
      });
      await page.keyboard.press("Escape");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
    }
  }
  await selectOption(page.getByLabel("Status for SYNC-1"), "in_progress");
  await expectValue(page.getByLabel("Status for SYNC-1"), "in_progress");
});

test("completion heatmap is shared across developer overview, profile and admin roster", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-21T06:00:00Z"));
  const { task, tables } = await workspace(page, "developer");
  tables.tasks = [
    { ...task, status: "completed", completed_at: "2026-10-20T06:00:00Z" },
  ];
  await page.goto("/dashboard");
  const heatmap = page.getByLabel("Task completions for Test Developer", {
    exact: true,
  });
  await expect(heatmap).toContainText("1 completion");
  await heatmap
    .getByRole("button", { name: "20 Oct 2026: 1 completed task", exact: true })
    .click();
  await expect(heatmap).toContainText("20 Oct 2026 · 1 completed task");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `docs/completion-heatmap-${theme}-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
    }
  }
  await page.goto("/profile");
  await expect(heatmap).toContainText("1 completion");
  await workspace(page, "super_admin");
  await page.goto("/dashboard");
  await page.getByRole("button").filter({ hasText: "Test Developer" }).click();
  await expect(
    page.getByLabel("Task completions for Test Developer", { exact: true }),
  ).toBeVisible();
});

test("team management drawer contains details, project access, history and archive controls", async ({
  page,
}) => {
  const { tables } = await workspace(page);
  tables.projects = [
    { id: "project-1", name: "Client Portal", archived: false },
  ];
  await page.goto("/admin/teams");
  await page
    .getByRole("button", { name: "Edit Test Team", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Manage team", exact: true });
  await drawer.getByLabel("Team name").fill("");
  await drawer.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(drawer.getByText("Enter a name", { exact: true })).toBeVisible();
  await drawer.getByLabel("Team name").fill("Delivery Team");
  let request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") && r.postDataJSON()?.action === "team",
  );
  await drawer.getByRole("button", { name: "Save team", exact: true }).click();
  expect((await request).postDataJSON().payload.name).toBe("Delivery Team");
  request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") &&
      r.postDataJSON()?.action === "project_membership",
  );
  await drawer.getByRole("tab", { name: "Projects", exact: true }).click();
  await expect(drawer.getByLabel("Team name")).toHaveCount(0);
  await drawer
    .getByRole("button", { name: "Grant access", exact: true })
    .click();
  expect((await request).postDataJSON().payload).toMatchObject({
    team_id: teamId,
    project_id: "project-1",
    remove: false,
  });
  await drawer.getByRole("tab", { name: "History", exact: true }).click();
  await expect(drawer.locator(".team-membership-timeline li")).toHaveCount(1);
  await drawer.getByRole("tab", { name: "Details", exact: true }).click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await drawer.getByLabel("Team name").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/team-management-drawer-${theme}-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
  request = page.waitForRequest(
    (r) =>
      r.url().includes("/rpc/command") && r.postDataJSON()?.action === "team",
  );
  await drawer
    .getByRole("button", { name: "Archive team", exact: true })
    .click();
  expect((await request).postDataJSON().payload.archived).toBe(true);
  await drawer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(drawer).toHaveCount(0);
});

test("wide team drawer uses a searchable photo person picker", async ({
  page,
}) => {
  const { tables } = await workspace(page);
  tables.team_memberships = [];
  const photo = "https://lh3.googleusercontent.com/person-picker-photo";
  (tables.profiles[1] as Record<string, unknown>).avatar_url = photo;
  await page.route(photo, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKH0AAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/teams");
  await page
    .getByRole("button", { name: "Edit Test Team", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Manage team", exact: true });
  expect((await drawer.boundingBox())!.width).toBeGreaterThan(900);
  await drawer.getByRole("tab", { name: "Members", exact: true }).click();
  await drawer.getByRole("button", { name: "Add member", exact: true }).click();
  const popover = page.getByRole("dialog", {
    name: "Add team member",
    exact: true,
  });
  const picker = popover.getByLabel("Team member", { exact: true });
  await picker.fill("tester@example.test");
  const option = popover
    .getByRole("option")
    .filter({ hasText: "Test Developer" });
  await expect(option.locator('[data-slot="avatar-image"]')).toBeVisible();
  await expect(option).toContainText("Developer");
  await option.click();
  await expectValue(picker, devId);
  await expect(
    popover.locator(
      ".person-picker .app-select__single-value [data-slot=avatar-image]",
    ),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await picker.scrollIntoViewIfNeeded();
      await picker.click();
      await page.screenshot({
        path: `docs/team-person-picker-${theme}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
});

test("team add actions use a photo picker popover on cards and in the drawer", async ({
  page,
}) => {
  const { tables } = await workspace(page);
  tables.team_memberships = [];
  await page.goto("/admin/teams");
  for (const inDrawer of [false, true]) {
    if (inDrawer) {
      await page
        .getByRole("button", { name: "Edit Test Team", exact: true })
        .click();
      await page.getByRole("tab", { name: "Members", exact: true }).click();
    }
    const scope = inDrawer
      ? page.getByRole("dialog", { name: "Manage team", exact: true })
      : page.locator("main");
    await scope
      .getByRole("button", { name: "Add member", exact: true })
      .click();
    const popover = page.getByRole("dialog", {
      name: "Add team member",
      exact: true,
    });
    await popover
      .getByRole("button", { name: "Add to team", exact: true })
      .click();
    await expect(
      popover.getByText("Select a team member", { exact: true }),
    ).toBeVisible();
    await selectOption(
      popover.getByLabel("Team member", { exact: true }),
      devId,
    );
    const request = page.waitForRequest(
      (r) =>
        r.url().includes("/rpc/command") &&
        r.postDataJSON()?.action === "membership",
    );
    await popover
      .getByRole("button", { name: "Add to team", exact: true })
      .click();
    expect((await request).postDataJSON().payload).toMatchObject({
      developer_id: devId,
      team_id: teamId,
      is_lead: false,
    });
    await expect(popover).toHaveCount(0);
    if (inDrawer) await expect(scope).toBeVisible();
  }
});

test("team drawers keep rounded corners and viewport margins on phones and desktop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await workspace(page);
  await page.goto("/admin/teams");
  await page
    .getByRole("button", { name: "Edit Test Team", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Manage team", exact: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const gap = width < 600 ? 8 : 12;
      await expect
        .poll(async () => Math.round((await drawer.boundingBox())!.y))
        .toBe(gap);
      const bounds = (await drawer.boundingBox())!;
      expect(Math.round(bounds.y + bounds.height)).toBe(900 - gap);
      expect(Math.round(bounds.x + bounds.width)).toBe(width - gap);
      expect(
        await drawer.evaluate(
          (el) => getComputedStyle(el).borderBottomRightRadius,
        ),
      ).toBe(width < 600 ? "16px" : "20px");
      await page.screenshot({
        path: `docs/drawer-inset-${theme}-${width}.png`,
      });
    }
  }
});

test("team summary cards show real task progress and open team management", async ({
  page,
}) => {
  const { task, tables } = await workspace(page);
  tables.tasks = [
    task,
    { ...task, id: "finished", status: "completed", completed_at: now },
  ];
  await page.goto("/admin/teams");
  const card = page.locator(".team-summary-card").filter({
    has: page.getByRole("heading", { name: "Test Team", exact: true }),
  });
  await expect(card).toContainText("Not assigned");
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "1 of 2 tasks completed",
  );
  await expect(
    card.locator(".team-avatar-stack [data-slot=avatar]"),
  ).toHaveCount(1);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `docs/team-summary-cards-${theme}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
  await card
    .getByRole("button", { name: "Edit Test Team", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Manage team", exact: true }),
  ).toBeVisible();
});

test("standup review filters tasks, searches members and navigates the roster", async ({
  page,
}) => {
  const { task, tables } = await workspace(page);
  tables.profiles.push({
    ...(tables.profiles[1] as object),
    id: "00000000-0000-4000-8000-000000000099",
    name: "Second Developer",
  });
  tables.team_memberships.push({
    id: "second",
    team_id: teamId,
    developer_id: "00000000-0000-4000-8000-000000000099",
    starts_on: "2020-01-01",
    ends_on: null,
    is_lead: false,
  });
  tables.tasks = [
    task,
    {
      ...task,
      id: "blocked",
      title: "Resolve deployment access",
      status: "blocked",
      blocker: "Waiting for credentials",
    },
  ];
  await page.goto("/admin/evening-standup");
  await page.getByRole("tab", { name: /Blocked/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Resolve deployment access",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: task.title, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next member", exact: true }).click();
  await expect(page.locator(".meeting-person")).toContainText(
    "Second Developer",
  );
  await expect(
    page.getByRole("heading", { name: "No current tasks", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Previous member", exact: true })
    .click();
  await page.getByLabel("Search meeting members").fill("missing");
  await expect(
    page.getByRole("heading", { name: "No matching members", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search meeting members").fill("");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `docs/standup-review-${theme}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
});

test("task register paginates filtered results and opens cmdk task search", async ({
  page,
}) => {
  const { task, tables } = await workspace(page);
  tables.tasks = Array.from({ length: 35 }, (_, i) => ({
    ...task,
    id: `search-${i}`,
    task_number: i + 1,
    title: `Milestone task ${i + 1}`,
    status: i % 2 ? "completed" : "planned",
  }));
  await page.goto("/admin/tasks");
  const rows = page.locator(".register-list .task-row");
  await expect(rows).toHaveCount(10);
  const pager = page.getByRole("navigation", {
    name: "Task register pagination",
    exact: true,
  });
  await expect(pager).toContainText("1–10 of 35 tasks");
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager).toContainText("11–20 of 35 tasks");
  await selectOption(pager.getByLabel("Rows per page", { exact: true }), "25");
  await expect(rows).toHaveCount(25);
  await expect(pager).toContainText("Page 1 of 2");
  await page
    .getByLabel("Search tasks", { exact: true })
    .fill("Milestone task 21");
  await expect(rows).toHaveCount(1);
  await expect(pager).toContainText("1–1 of 1 tasks");
  await page.getByLabel("Search tasks", { exact: true }).fill("");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", {
    name: "Search tasks",
    exact: true,
  });
  await dialog
    .getByLabel("Search task keywords", { exact: true })
    .fill("Milestone task 21");
  await dialog
    .getByRole("option")
    .filter({ hasText: "Milestone task 21" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Milestone task 21");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open task search", exact: true })
    .click();
  await dialog
    .getByLabel("Search task keywords", { exact: true })
    .fill("Milestone task 21");
  await dialog
    .getByRole("option")
    .filter({ hasText: "matching tasks in the register" })
    .click();
  await expect(rows).toHaveCount(1);
  await page.getByLabel("Search tasks", { exact: true }).fill("no matches");
  await expect(pager).toContainText("0 tasks");
  await expect(
    pager.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Search tasks", { exact: true }).fill("");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page
        .getByRole("button", { name: "Open task search", exact: true })
        .click();
      await dialog.evaluate((element) =>
        Promise.all(
          element.getAnimations().map((animation) => animation.finished),
        ),
      );
      await page.screenshot({
        path: `docs/task-command-${theme}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
});
