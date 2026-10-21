// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Task, WorkLog } from "../types/database";
const db = new PGlite({ extensions: { btree_gist, pg_trgm } });
const root = "00000000-0000-4000-8000-000000000001",
  lead = "00000000-0000-4000-8000-000000000002",
  dev = "00000000-0000-4000-8000-000000000003",
  other = "00000000-0000-4000-8000-000000000004",
  pending = "00000000-0000-4000-8000-000000000005",
  team = "00000000-0000-4000-8000-000000000010",
  team2 = "00000000-0000-4000-8000-000000000011";
async function as(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function run<T = Record<string, unknown>>(
  action: string,
  payload: object,
) {
  const result = await db.query<{ value: T }>(
    "select public.command($1,$2::jsonb) as value",
    [action, JSON.stringify(payload)],
  );
  return result.rows[0].value;
}
let task: Task, work: WorkLog, leaveType: string;
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role; create publication supabase_realtime;`,
  );
  await db.exec(
    "alter table auth.users add column raw_app_meta_data jsonb default '{}', add column banned_until timestamptz, add column aud text, add column role text, add column created_at timestamptz, add column updated_at timestamptz",
  );
  await db.exec(
    `insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000006','existing@example.test','{"full_name":"Existing User","role":"super_admin"}')`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610200001_foundation.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610200002_commands.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610200003_existing_auth_profiles.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610200004_developer_workflow.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610200005_task_based_memberships.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610210001_google_profile_photos.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610210002_task_search.sql", "utf8"),
  );
  for (const [id, name] of [
    [root, "Root"],
    [lead, "Lead"],
    [dev, "Developer"],
    [other, "Other"],
    [pending, "Pending"],
  ])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        id,
        `${name.toLowerCase()}@example.test`,
        JSON.stringify({ full_name: name, role: "super_admin" }),
      ],
    );
  await db.exec(
    `update profiles set role='super_admin',status='active' where id='${root}';update profiles set role='admin',status='active' where id='${lead}';update profiles set status='active' where id in ('${dev}','${other}');insert into teams(id,name) values('${team}','Team A'),('${team2}','Team B');insert into team_memberships(team_id,developer_id,is_lead,starts_on) values('${team}','${lead}',true,'2020-01-01'),('${team}','${dev}',false,'2020-01-01'),('${team2}','${other}',false,'2020-01-01');`,
  );
  leaveType = (
    await db.query<{ id: string }>("select id from leave_types limit 1")
  ).rows[0].id;
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL migrations and authorization", () => {
  it("creates pending developer profiles for accounts registered before schema deployment", async () => {
    await as("00000000-0000-4000-8000-000000000006");
    expect(
      (await db.query("select name,role,status from profiles")).rows,
    ).toEqual([
      { name: "Existing User", role: "developer", status: "pending" },
    ]);
    await db.exec("reset role");
    await db.exec(
      readFileSync(
        "supabase/migrations/202610200003_existing_auth_profiles.sql",
        "utf8",
      ),
    );
    expect(
      (
        await db.query(
          "select id from profiles where email='existing@example.test'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("ignores metadata role claims and keeps new accounts pending", async () => {
    await as(pending);
    const p = (
      await db.query<{ role: string; status: string }>(
        "select role,status from profiles",
      )
    ).rows;
    expect(p).toEqual([{ role: "developer", status: "pending" }]);
    await expect(run("team", { name: "Attack" })).rejects.toThrow(
      /Active account/,
    );
    expect((await db.query("select * from tasks")).rows).toHaveLength(0);
  });
  it("rejects direct role escalation, audit mutation and unapproved access", async () => {
    await as(dev);
    await expect(
      db.exec("update profiles set role='super_admin'"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("delete from audit_logs")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      run("user", { id: dev, role: "super_admin", status: "active" }),
    ).rejects.toThrow(/Super Admin/);
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
  });
  it("allows a super admin to approve an account but protects the last super admin", async () => {
    await as(root);
    await run("user", { id: pending, role: "developer", status: "active" });
    await expect(
      run("user", { id: root, role: "developer", status: "active" }),
    ).rejects.toThrow(/last active Super Admin/);
  });
  it("scopes team leads and rejects cross-team assignments", async () => {
    await as(lead);
    expect((await db.query("select * from teams")).rows).toHaveLength(1);
    await expect(
      run("task", { title: "Wrong scope", team_id: team2, assignee_id: other }),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      run("task", { title: "Wrong member", team_id: team, assignee_id: other }),
    ).rejects.toThrow(/active member/);
    task = await run<Task>("task", {
      title: "Implement view",
      team_id: team,
      assignee_id: dev,
      status: "planned",
    });
  });
  it("enforces developer self-access and task field restrictions", async () => {
    await as(other);
    expect((await db.query("select * from tasks")).rows).toHaveLength(0);
    await expect(
      run("task", {
        id: task.id,
        status: "completed",
        expected_updated_at: task.updated_at,
      }),
    ).rejects.toThrow(/Not authorized/);
    await as(dev);
    await expect(
      run("task", {
        id: task.id,
        title: "Changed",
        expected_updated_at: task.updated_at,
      }),
    ).rejects.toThrow(/Only your task/);
    task = await run<Task>("task", {
      id: task.id,
      status: "in_progress",
      expected_updated_at: task.updated_at,
    });
    expect(task.status).toBe("in_progress");
    await expect(
      run("task", {
        id: task.id,
        status: "completed",
        expected_updated_at: "2020-01-01",
      }),
    ).rejects.toThrow(/Task changed/);
    expect(
      (await db.query("select * from task_status_history")).rows.length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("saves daily work and snapshots once; rejects duplicate submitted edits and self-review", async () => {
    await as(dev);
    work = await run<WorkLog>("work_log", {
      work_date: "2025-01-06",
      hours: 8,
      completed_work: "View implemented",
      remaining_work: "Testing",
      status: "submitted",
      task_updates: [{ task_id: task.id }],
    });
    expect(Number(work.hours)).toBe(8);
    expect(
      (await db.query("select * from daily_task_updates")).rows,
    ).toHaveLength(1);
    await expect(
      run("work_log", {
        work_date: "2025-01-06",
        hours: 16,
        status: "submitted",
      }),
    ).rejects.toThrow(/locked/);
    await expect(
      run("review", { id: work.id, status: "approved" }),
    ).rejects.toThrow(/different reviewer/);
  });
  it("supports revision, resubmission, approval and locked approved records", async () => {
    await as(lead);
    await run("review", {
      id: work.id,
      status: "revision_requested",
      review_note: "Add testing detail",
    });
    await as(dev);
    const fresh = (
      await db.query<WorkLog>("select * from daily_work_logs where id=$1", [
        work.id,
      ])
    ).rows[0];
    work = await run<WorkLog>("work_log", {
      work_date: "2025-01-06",
      hours: 8,
      completed_work: "View and tests",
      status: "submitted",
      expected_updated_at: fresh.updated_at,
      task_updates: [{ task_id: task.id }],
    });
    await as(lead);
    work = await run<WorkLog>("review", { id: work.id, status: "approved" });
    expect(work.status).toBe("approved");
    await as(dev);
    await expect(
      run("work_log", {
        work_date: work.work_date,
        status: "draft",
        hours: 8,
        expected_updated_at: work.updated_at,
      }),
    ).rejects.toThrow(/locked/);
  });
  it("confirms meeting plans transactionally with stable task IDs", async () => {
    await as(lead);
    const s = await run<{ id: string }>("plan", {
      team_id: team,
      meeting_date: "2025-01-06",
      period: "morning",
      state: "confirmed",
      notes: "Continue",
      assignments: [{ task_id: task.id, developer_id: dev }],
    });
    expect(s.id).toBeTruthy();
    expect(
      (await db.query("select task_id from standup_assignments")).rows,
    ).toEqual([{ task_id: task.id }]);
    expect((await db.query("select id from tasks")).rows).toHaveLength(1);
  });
  it("prevents self leave approval and overlapping approved requests; applies attendance defaults", async () => {
    await as(dev);
    const l = await run<{ id: string }>("leave", {
      leave_type_id: leaveType,
      starts_on: "2025-01-07",
      ends_on: "2025-01-07",
      half_day: false,
    });
    await expect(
      run("leave_decision", { id: l.id, status: "approved" }),
    ).rejects.toThrow(/Cannot review/);
    await as(lead);
    await run("leave_decision", { id: l.id, status: "approved" });
    await as(dev);
    const defaultHours = (
      await db.query<{ value: { hours: number } }>(
        "select expected_attendance($1,$2) as value",
        [dev, "2025-01-07"],
      )
    ).rows[0].value;
    expect(defaultHours.hours).toBe(0);
    const l2 = await run<{ id: string }>("leave", {
      leave_type_id: leaveType,
      starts_on: "2025-01-07",
      ends_on: "2025-01-07",
    });
    await as(lead);
    await expect(
      run("leave_decision", { id: l2.id, status: "approved" }),
    ).rejects.toThrow(/exclusion constraint/);
    await as(dev);
    const leaveLog = await run<WorkLog>("work_log", {
      work_date: "2025-01-07",
      hours: 8,
      status: "draft",
    });
    expect(Number(leaveLog.hours)).toBe(0);
    expect(leaveLog.attendance).toBe("on_leave");
  });
  it("applies half-day defaults, holiday precedence and prevents approvals changing locked reports", async () => {
    await as(dev);
    const l = await run<{ id: string }>("leave", {
      leave_type_id: leaveType,
      starts_on: "2025-01-08",
      ends_on: "2025-01-08",
      half_day: true,
    });
    await as(lead);
    await run("leave_decision", { id: l.id, status: "approved" });
    const expected = (
      await db.query<{ value: { hours: number } }>(
        "select expected_attendance($1,$2) as value",
        [dev, "2025-01-08"],
      )
    ).rows[0].value;
    expect(expected.hours).toBe(4);
    await as(dev);
    const conflicting = await run<{ id: string }>("leave", {
      leave_type_id: leaveType,
      starts_on: work.work_date,
      ends_on: work.work_date,
    });
    await as(lead);
    await expect(
      run("leave_decision", { id: conflicting.id, status: "approved" }),
    ).rejects.toThrow(/Reopen/);
    await as(root);
    await run("holiday", { holiday_date: "2025-01-08", name: "Holiday" });
    expect(
      (
        await db.query<{ value: { attendance: string } }>(
          "select expected_attendance($1,$2) as value",
          [dev, "2025-01-08"],
        )
      ).rows[0].value.attendance,
    ).toBe("holiday");
  });
  it("deactivation revokes existing sessions and every application table has RLS", async () => {
    await as(root);
    await run("user", { id: other, role: "developer", status: "inactive" });
    await as(other);
    expect((await db.query("select * from teams")).rows).toHaveLength(0);
    await expect(
      run("profile", { name: "Attack", job_title: "Developer" }),
    ).rejects.toThrow(/Active account/);
    await db.exec("reset role");
    const tables = (
      await db.query<{ relname: string; relrowsecurity: boolean }>(
        "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
      )
    ).rows;
    expect(tables.length).toBe(23);
    expect(tables.every((t) => t.relrowsecurity)).toBe(true);
  });
  it("manages project scope, modules and contributor access without broadening private records", async () => {
    await as(root);
    const project = await run<{ id: string }>("project", {
      name: "Scoped project",
    });
    const module = await run<{ id: string }>("module", {
      project_id: project.id,
      name: "Case details",
    });
    await as(lead);
    await expect(
      run("task", {
        team_id: team,
        title: "Scoped work",
        project_id: project.id,
        module_id: module.id,
        assignee_id: dev,
      }),
    ).rejects.toThrow(/outside this team/);
    await as(root);
    await run("project_membership", { project_id: project.id, team_id: team });
    await run("user", { id: other, role: "developer", status: "active" });
    await run("membership", {
      developer_id: other,
      team_id: team,
      is_lead: false,
    });
    await as(lead);
    const shared = await run<Task>("task", {
      team_id: team,
      title: "Shared work",
      project_id: project.id,
      module_id: module.id,
      assignee_id: dev,
    });
    await run("contributor", { task_id: shared.id, developer_id: other });
    await as(other);
    expect(
      (await db.query("select id from tasks where id=$1", [shared.id])).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select id from daily_work_logs where developer_id=$1", [
          dev,
        ])
      ).rows,
    ).toHaveLength(0);
    await run("comment", { task_id: shared.id, body: "Contributor comment" });
    expect(
      (
        await db.query("select body from task_comments where task_id=$1", [
          shared.id,
        ])
      ).rows,
    ).toEqual([{ body: "Contributor comment" }]);
  });
  it("bulk edits roll back completely when a later task fails validation", async () => {
    await as(lead);
    const fresh = (
      await db.query<Task>("select * from tasks where id=$1", [task.id])
    ).rows[0];
    await expect(
      run("bulk_tasks", {
        tasks: [
          {
            id: task.id,
            status: "completed",
            expected_updated_at: fresh.updated_at,
          },
          { id: "00000000-0000-4000-8000-999999999999", status: "completed" },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (await db.query<Task>("select * from tasks where id=$1", [task.id]))
        .rows[0].status,
    ).toBe(fresh.status);
  });
  it("revising an older work log preserves its captured task status after the task changes", async () => {
    await as(lead);
    await run("review", {
      id: work.id,
      status: "revision_requested",
      review_note: "Clarify work note",
    });
    const fresh = (
      await db.query<Task>("select * from tasks where id=$1", [task.id])
    ).rows[0];
    await run("task", {
      id: task.id,
      status: "completed",
      expected_updated_at: fresh.updated_at,
    });
    await as(dev);
    const log = (
      await db.query<WorkLog>("select * from daily_work_logs where id=$1", [
        work.id,
      ])
    ).rows[0];
    work = await run<WorkLog>("work_log", {
      work_date: work.work_date,
      hours: 8,
      status: "submitted",
      expected_updated_at: log.updated_at,
      completed_work: "Clarified note",
      task_updates: [{ task_id: task.id }],
    });
    expect(
      (
        await db.query<{ status: string }>(
          "select status from daily_task_updates where work_log_id=$1",
          [work.id],
        )
      ).rows[0].status,
    ).toBe("in_progress");
    await as(lead);
    work = await run<WorkLog>("review", { id: work.id, status: "approved" });
  });
  it("demo seeding maps only existing approved users and labels every fabricated record", async () => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    const ids = Array.from(
      { length: 8 },
      (_, i) => `00000000-0000-4000-8000-00000000010${i}`,
    );
    for (const id of ids) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `${id}@test.invalid`,
      ]);
      await db.query("update profiles set status='active' where id=$1", [id]);
    }
    await db.exec(readFileSync("supabase/demo-data.sql", "utf8"));
    await db.query("call pg_temp.seed_syncora_demo($1::uuid[],$2::uuid)", [
      ids,
      root,
    ]);
    expect(
      (await db.query("select id from tasks where title like '[DEMO]%'")).rows,
    ).toHaveLength(8);
    expect(
      (
        await db.query(
          "select id from daily_work_logs where developer_id=any($1::uuid[])",
          [ids],
        )
      ).rows,
    ).toHaveLength(16);
    await expect(
      db.query("call pg_temp.seed_syncora_demo($1::uuid[],$2::uuid)", [
        ids,
        root,
      ]),
    ).rejects.toThrow();
  });
  it("retains task ownership through a team move without rewriting historical reports", async () => {
    await as(root);
    const fresh = (
      await db.query<Task>("select * from tasks where id=$1", [task.id])
    ).rows[0];
    await run("membership", {
      developer_id: dev,
      team_id: team2,
      is_lead: false,
    });
    await as(dev);
    const moved = await run<Task>("task", {
      id: task.id,
      status: "completed",
      expected_updated_at: fresh.updated_at,
    });
    expect(moved.assignee_id).toBe(dev);
    expect(moved.team_id).toBe(team);
    expect(
      (
        await db.query<WorkLog>("select * from daily_work_logs where id=$1", [
          work.id,
        ])
      ).rows[0].team_id,
    ).toBe(team);
  });
});

it("seeds a removable sandbox without changing accounts or unrelated tasks", async () => {
  await db.exec("reset role");
  const before = await db.query("select id from public.tasks order by id");
  const profiles = await db.query(
    "select id,role,status from public.profiles order by id",
  );
  await db.query("update public.profiles set email=$1 where id=$2", [
    "nayanajithdev@gmail.com",
    root,
  ]);
  const seed = readFileSync("supabase/testing/seed.sql", "utf8");
  const cleanup = readFileSync("supabase/testing/cleanup.sql", "utf8");
  await db.exec(seed);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.tasks where team_id='5c0a0000-0000-4000-8000-000000000001'",
      )
    ).rows[0].count,
  ).toBe(24);
  await expect(db.exec(seed)).rejects.toThrow("Test sandbox already exists");
  await db.exec("rollback");
  await db.exec(cleanup);
  await db.exec(cleanup);
  expect(
    (await db.query("select id from public.tasks order by id")).rows,
  ).toEqual(before.rows);
  expect(
    (await db.query("select id,role,status from public.profiles order by id"))
      .rows,
  ).toEqual(profiles.rows);
  expect(
    (
      await db.query(
        "select id from public.teams where id='5c0a0000-0000-4000-8000-000000000001'",
      )
    ).rows,
  ).toHaveLength(0);
  await db.query("update public.profiles set email=$1 where id=$2", [
    "root@example.test",
    root,
  ]);
});

it("lets developers create normal self-owned tasks and report progress to admins", async () => {
  await as(dev);
  const own = await run<Task>("task", {
    title: "Developer-owned work",
    team_id: team2,
    status: "planned",
  });
  expect(own.assignee_id).toBe(dev);
  expect(own.assigned_by).toBe(dev);
  expect(own.unplanned).toBe(false);
  const started = await run<Task>("task", {
    id: own.id,
    status: "in_progress",
    expected_updated_at: own.updated_at,
  });
  const finished = await run<Task>("task", {
    id: own.id,
    status: "completed",
    expected_updated_at: started.updated_at,
  });
  expect(finished.completed_at).toBeTruthy();
  await expect(
    run("task", { title: "Wrong team", team_id: team }),
  ).rejects.toThrow(/Not authorized/);
  await expect(
    run("task", {
      title: "Assign someone else",
      team_id: team2,
      assignee_id: lead,
    }),
  ).rejects.toThrow(/Not authorized/);
  await as(root);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from tasks where id=$1",
        [own.id],
      )
    ).rows[0].status,
  ).toBe("completed");
});

it("derives daily hours from the calendar instead of trusting entered hours", async () => {
  await as(dev);
  const normal = await run<WorkLog>("work_log", {
    work_date: "2024-01-08",
    status: "draft",
    hours: 23,
    attendance: "half_day",
  });
  expect(Number(normal.hours)).toBe(8);
  expect(normal.attendance).toBe("working");
  const weekend = await run<WorkLog>("work_log", {
    work_date: "2024-01-07",
    status: "draft",
    hours: 8,
  });
  expect(Number(weekend.hours)).toBe(0);
  await db.exec("reset role");
  await db.query(
    "insert into leave_requests(developer_id,team_id,leave_type_id,starts_on,ends_on,half_day,status) values($1,$2,$3,'2024-01-09','2024-01-09',true,'approved')",
    [dev, team, leaveType],
  );
  await as(dev);
  const half = await run<WorkLog>("work_log", {
    work_date: "2024-01-09",
    status: "draft",
    hours: 8,
  });
  expect(Number(half.hours)).toBe(4);
});

it("seeds dated task scenarios with banned dummy users and removes them without touching real data", async () => {
  await db.exec("reset role");
  await db.exec(
    "alter table auth.users add column if not exists raw_app_meta_data jsonb default '{}', add column if not exists banned_until timestamptz, add column if not exists aud text, add column if not exists role text, add column if not exists created_at timestamptz, add column if not exists updated_at timestamptz",
  );
  const beforeUsers = (await db.query("select id from auth.users order by id"))
    .rows;
  const beforeTasks = (await db.query("select id from tasks order by id")).rows;
  const beforeLogs = (
    await db.query("select id from daily_work_logs order by id")
  ).rows;
  await db.query("update profiles set email=$1 where id=$2", [
    "nayanajithdev@gmail.com",
    root,
  ]);
  const seed = readFileSync("supabase/testing/scenarios.sql", "utf8");
  await db.exec(seed);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from auth.users where raw_app_meta_data->>'syncora_test_batch'='task-history-v1' and banned_until='infinity' and email like '%@example.invalid'",
      )
    ).rows[0].count,
  ).toBe(6);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from tasks where team_id::text like '5c0b%'",
      )
    ).rows[0].count,
  ).toBe(36);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from task_status_history where detail->>'seed_batch'='task-history-v1'",
      )
    ).rows[0].count,
  ).toBe(90);
  expect(
    (
      await db.query(
        "select id from task_status_history where detail->>'seed_batch'='task-history-v1' and created_at>now()",
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select id from daily_work_logs order by id")).rows,
  ).toEqual(beforeLogs);
  await expect(db.exec(seed)).rejects.toThrow("already exists");
  await db.exec("rollback");
  await db.exec(
    "update auth.users set banned_until=null where id='5c0b0000-0000-4000-8000-000000000101'",
  );
  await expect(
    db.exec(readFileSync("supabase/testing/cleanup.sql", "utf8")),
  ).rejects.toThrow("Dummy account identity changed");
  await db.exec("rollback");
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from tasks where team_id::text like '5c0b%'",
      )
    ).rows[0].count,
  ).toBe(36);
  await db.exec(
    "update auth.users set banned_until='infinity' where id='5c0b0000-0000-4000-8000-000000000101'",
  );
  await db.exec(readFileSync("supabase/testing/cleanup.sql", "utf8"));
  await db.exec(readFileSync("supabase/testing/cleanup.sql", "utf8"));
  expect(
    (await db.query("select id from auth.users order by id")).rows,
  ).toEqual(beforeUsers);
  expect((await db.query("select id from tasks order by id")).rows).toEqual(
    beforeTasks,
  );
  expect(
    (await db.query("select id from daily_work_logs order by id")).rows,
  ).toEqual(beforeLogs);
  await db.query("update profiles set email=$1 where id=$2", [
    "root@example.test",
    root,
  ]);
});

it("supports multiple developers working across multiple shared projects without granting unrelated project access", async () => {
  await db.exec("reset role; begin");
  try {
    await as(root);
    for (const developer_id of [dev, other]) {
      await run("user", {
        id: developer_id,
        role: "developer",
        status: "active",
      });
      await run("membership", { team_id: team2, developer_id, is_lead: false });
    }
    const projects = [];
    for (const name of ["Shared portal", "Shared delivery"]) {
      const project = await run<{ id: string }>("project", { name });
      for (const team_id of [team, team2])
        await run("project_membership", { project_id: project.id, team_id });
      projects.push(project);
    }
    const privateProject = await run<{ id: string }>("project", {
      name: "Unrelated project",
    });
    await run("project_membership", {
      project_id: privateProject.id,
      team_id: team,
    });
    const created: Task[] = [];
    for (const developer of [dev, other]) {
      await as(developer);
      for (const project of projects) {
        const own = await run<Task>("task", {
          team_id: team2,
          project_id: project.id,
          title: `${developer} work on ${project.id}`,
        });
        expect(own.assignee_id).toBe(developer);
        expect(own.project_id).toBe(project.id);
        const started = await run<Task>("task", {
          id: own.id,
          status: "in_progress",
          expected_updated_at: own.updated_at,
        });
        expect(started.status).toBe("in_progress");
        created.push(started);
      }
      await db.exec("savepoint denied_project");
      await expect(
        run("task", {
          team_id: team2,
          project_id: privateProject.id,
          title: "Outside scope",
        }),
      ).rejects.toThrow(/outside this team/);
      await db.exec("rollback to savepoint denied_project");
    }
    await as(root);
    const visible = await db.query<Task>(
      "select * from tasks where id = any($1::uuid[])",
      [created.map((t) => t.id)],
    );
    expect(visible.rows).toHaveLength(4);
    for (const project of projects)
      expect(
        new Set(
          visible.rows
            .filter((t) => t.project_id === project.id)
            .map((t) => t.assignee_id),
        ).size,
      ).toBe(2);
  } finally {
    await db.exec("rollback; reset role");
  }
});

it("allows same-day team moves and removal after a daily record while preserving historical teams", async () => {
  await db.exec("reset role; begin");
  try {
    await as(root);
    await run("membership", { developer_id: dev, team_id: team });
    const date = (
      await db.query<{ date: string }>(
        "select (now() at time zone 'Asia/Colombo')::date::text as date",
      )
    ).rows[0].date;
    await db.exec("reset role");
    const log = (
      await db.query<{ id: string }>(
        "insert into daily_work_logs(developer_id,team_id,work_date,hours) values($1,$2,$3,8) returning id",
        [dev, team, date],
      )
    ).rows[0];
    await as(dev);
    const own = await run<Task>("task", {
      title: "Original team work",
      team_id: team,
    });
    await as(root);
    await run("membership", { developer_id: dev, team_id: team2 });
    await run("membership", { developer_id: dev, team_id: team2 });
    expect(
      (
        await db.query(
          "select id from team_memberships where developer_id=$1 and starts_on<=$2 and (ends_on is null or ends_on>$2)",
          [dev, date],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ team_id: string }>(
          "select team_id from daily_work_logs where id=$1",
          [log.id],
        )
      ).rows[0].team_id,
    ).toBe(team);
    expect(
      (
        await db.query<{ team_id: string }>(
          "select team_id from tasks where id=$1",
          [own.id],
        )
      ).rows[0].team_id,
    ).toBe(team);
    await run("membership", { developer_id: dev, team_id: null });
    expect(
      (
        await db.query(
          "select id from team_memberships where developer_id=$1 and starts_on<=$2 and (ends_on is null or ends_on>$2)",
          [dev, date],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select id from team_memberships where developer_id=$1 and ends_on=$2",
          [dev, date],
        )
      ).rows.length,
    ).toBeGreaterThanOrEqual(3);
  } finally {
    await db.exec("rollback; reset role");
  }
});

it("synchronizes Google photo metadata without opening profile write permissions", async () => {
  await db.exec("reset role; begin");
  const id = "00000000-0000-4000-8000-000000000098";
  try {
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'photo@example.test',$2::jsonb)",
      [
        id,
        JSON.stringify({
          full_name: "Photo test",
          avatar_url: "https://lh3.googleusercontent.com/avatar",
        }),
      ],
    );
    expect(
      (
        await db.query<{ avatar_url: string }>(
          "select avatar_url from profiles where id=$1",
          [id],
        )
      ).rows[0].avatar_url,
    ).toBe("https://lh3.googleusercontent.com/avatar");
    await db.query(
      "update auth.users set raw_user_meta_data=$2::jsonb where id=$1",
      [
        id,
        JSON.stringify({
          avatar_url: "http://invalid.test",
          picture: "https://lh3.googleusercontent.com/updated",
        }),
      ],
    );
    expect(
      (
        await db.query<{ avatar_url: string }>(
          "select avatar_url from profiles where id=$1",
          [id],
        )
      ).rows[0].avatar_url,
    ).toBe("https://lh3.googleusercontent.com/updated");
    await db.query(
      "update auth.users set raw_user_meta_data='{}'::jsonb where id=$1",
      [id],
    );
    expect(
      (
        await db.query<{ avatar_url: string | null }>(
          "select avatar_url from profiles where id=$1",
          [id],
        )
      ).rows[0].avatar_url,
    ).toBeNull();
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('authenticated','public.sync_profile_photo()','execute') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  } finally {
    await db.exec("reset role; rollback");
  }
});

it("searches tasks with ranked full text, prefixes, typos, filters and RLS-safe pagination", async () => {
  const searchLead = "00000000-0000-4000-8000-000000000081";
  const searchTeam = "00000000-0000-4000-8000-000000000082";
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email) values($1,'search-lead@example.test')",
    [searchLead],
  );
  await db.query(
    "update profiles set role='admin',status='active' where id=$1",
    [searchLead],
  );
  await db.query("insert into teams(id,name) values($1,'Search team')", [
    searchTeam,
  ]);
  await db.query(
    "insert into team_memberships(team_id,developer_id,is_lead,starts_on) values($1,$2,true,'2020-01-01')",
    [searchTeam, searchLead],
  );
  await as(root);
  const item = await run<Task>("task", {
    title: "Authentication token refresh",
    description: "Repair expired credentials",
    team_id: searchTeam,
    assignee_id: searchLead,
    status: "planned",
    priority: "medium",
  });
  await run<Task>("task", {
    title: "Authentication private team",
    team_id: team2,
    assignee_id: null,
    status: "planned",
    priority: "medium",
  });
  const search = async (query: string, filters = {}, page = 0, limit = 10) =>
    (
      await db.query<{
        result: { items: Task[]; total: number; page: number };
      }>("select search_tasks($1,$2::jsonb,$3,$4) result", [
        query,
        JSON.stringify(filters),
        page,
        limit,
      ])
    ).rows[0].result;
  await as(searchLead);
  expect((await search("authentication")).items.map((t) => t.id)).toContain(
    item.id,
  );
  expect((await search("authetication")).items.map((t) => t.id)).toContain(
    item.id,
  );
  expect((await search("Authent")).items.map((t) => t.id)).toContain(item.id);
  expect(
    (await search("expired credentials")).items.map((t) => t.id),
  ).toContain(item.id);
  expect((await search(`SYNC-${item.task_number}`)).items[0].id).toBe(item.id);
  expect((await search("authentication")).total).toBe(1);
  expect((await search("authentication", { team_id: team2 })).total).toBe(0);
  expect((await search("authentication", { status: "completed" })).total).toBe(
    0,
  );
  expect((await search("authentication", {}, 900)).page).toBe(0);
  await expect(search("", {}, 0, 100000)).rejects.toThrow(/pagination/);
  await expect(search("", { invalid: "value" })).rejects.toThrow(/filter/);
  await as(pending);
  // An active but unrelated developer cannot discover matching task counts.
  expect((await search("authentication")).total).toBe(0);
  await db.exec("reset role; set role anon");
  await expect(search("authentication")).rejects.toThrow(/permission denied/);
});
