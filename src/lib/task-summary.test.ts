import { expect, it } from "vitest";
import { taskSummary } from "./task-summary";
import type { Task, Tables, Profile, Team } from "../types/database";
const alice = { id: "alice", name: "Alice" } as Profile;
const bob = { id: "bob", name: "Bob" } as Profile;
const team = { id: "team", name: "Product" } as Team;
const task = (values: Partial<Task> = {}): Task => ({
  id: "task",
  task_number: 1,
  title: "Improve task search",
  description: "",
  team_id: "team",
  project_id: null,
  module_id: null,
  priority: "medium",
  status: "in_progress",
  assignee_id: "alice",
  assigned_by: "alice",
  target_date: null,
  start_date: null,
  completed_at: null,
  blocker: "",
  blocker_owner: null,
  unplanned: false,
  created_at: "2026-10-18T06:00:00Z",
  updated_at: "2026-10-20T06:00:00Z",
  ...values,
});
const event = (
  new_status: Tables["task_status_history"]["new_status"],
  created_at: string,
  values: Partial<Tables["task_status_history"]> = {},
): Tables["task_status_history"] => ({
  id: created_at,
  task_id: "task",
  old_status: "planned",
  new_status,
  assignee_id: "alice",
  actor_id: "alice",
  detail: {},
  created_at,
  ...values,
});
const data = (
  tasks: Task[],
  history: Tables["task_status_history"][] = [],
) => ({ tasks, history, people: [alice, bob], teams: [team] });

it("reconstructs past status instead of using the current completed state", () => {
  const text = taskSummary(
    "2026-10-19",
    "person",
    data(
      [task({ status: "completed", completed_at: "2026-10-20T06:00:00Z" })],
      [
        event("in_progress", "2026-10-19T06:00:00Z"),
        event("completed", "2026-10-20T06:00:00Z"),
      ],
    ),
  );
  expect(text).toContain("*Alice (Product)*");
  expect(text).toContain("*In progress*");
  expect(text).toContain("Improve task search");
  expect(text).not.toContain("*Done*");
});
it("includes completions only on the selected Sri Lanka date", () => {
  const text = taskSummary(
    "2026-10-19",
    "team",
    data(
      [
        task({ status: "completed" }),
        task({ id: "old", title: "Old completion", status: "completed" }),
      ],
      [
        event("completed", "2026-10-18T18:30:00Z"),
        event("completed", "2026-10-18T18:29:59Z", { task_id: "old" }),
      ],
    ),
  );
  expect(text).toContain("*Product*");
  expect(text).toContain("*Done*");
  expect(text).toContain("Alice: SYNC-1 Improve task search");
  expect(text).not.toContain("Old completion");
});
it("uses historical ownership and blocker details with developer and status filters", () => {
  const source = {
    ...data(
      [task({ assignee_id: "bob", blocker: "Current blocker" })],
      [
        event("blocked", "2026-10-19T06:00:00Z", {
          detail: { blocker: "Waiting for API access" },
        }),
      ],
    ),
    developer: "alice",
    status: "blocked",
  };
  const text = taskSummary("2026-10-19", "person", source);
  expect(text).toContain("Alice");
  expect(text).toContain("Waiting for API access");
  expect(text).not.toContain("Current blocker");
  expect(
    taskSummary("2026-10-19", "person", { ...source, developer: "bob" }),
  ).toContain("No task progress available");
});
it("generates current task summaries without daily records or history rows", () => {
  expect(taskSummary("2026-10-20", "person", data([task()]))).toContain(
    "*In progress*",
  );
  expect(taskSummary("2026-10-20", "person", data([]))).toContain(
    "No task progress available",
  );
});
it("does not invent past status when historical information is missing", () => {
  const text = taskSummary(
    "2026-10-19",
    "person",
    data([task({ status: "completed" })]),
  );
  expect(text).toContain("Status history unavailable");
  expect(text).not.toContain("*Done*");
});
it("excludes tasks created after the selected day and cancelled work", () => {
  const text = taskSummary(
    "2026-10-19",
    "person",
    data([
      task({ created_at: "2026-10-19T18:30:00Z" }),
      task({
        id: "cancelled",
        status: "cancelled",
        updated_at: "2026-10-18T06:00:00Z",
      }),
    ]),
  );
  expect(text).toContain("No task progress available");
});

it("does not count metadata edits on completed tasks as new completions", () => {
  const text = taskSummary(
    "2026-10-19",
    "person",
    data(
      [task({ status: "completed", completed_at: "2026-10-18T06:00:00Z" })],
      [
        event("completed", "2026-10-18T06:00:00Z"),
        event("completed", "2026-10-19T06:00:00Z", { old_status: "completed" }),
      ],
    ),
  );
  expect(text).toContain("No task progress available");
});
