import { expect, it } from "vitest";
import { calendarTasks, daysInProgress, dayBounds } from "./task-calendar";
import type { Tables, Task } from "../types/database";
const task = {
  id: "task",
  created_at: "2026-10-15T06:00:00Z",
  updated_at: "2026-10-20T06:00:00Z",
  status: "completed",
  completed_at: "2026-10-20T06:00:00Z",
  start_date: null,
} as Task;
const event = (
  date: string,
  old_status: Tables["task_status_history"]["old_status"],
  new_status: Tables["task_status_history"]["new_status"],
) =>
  ({
    id: date,
    task_id: task.id,
    created_at: date,
    old_status,
    new_status,
    assignee_id: "dev",
  }) as Tables["task_status_history"];
const history = [
  event("2026-10-15T06:00:00Z", null, "planned"),
  event("2026-10-16T06:00:00Z", "planned", "in_progress"),
  event("2026-10-20T06:00:00Z", "in_progress", "completed"),
];
it("carries unfinished tasks through each day and shows completion only on its day", () => {
  expect(calendarTasks("2026-10-14", [task], history)).toEqual([]);
  expect(calendarTasks("2026-10-15", [task], history)[0].status).toBe(
    "planned",
  );
  expect(calendarTasks("2026-10-19", [task], history)[0].status).toBe(
    "in_progress",
  );
  expect(calendarTasks("2026-10-20", [task], history)[0].status).toBe(
    "completed",
  );
  expect(calendarTasks("2026-10-21", [task], history)).toEqual([]);
});
it("counts distinct days in progress, excluding weekends, holidays and planned time", () => {
  expect(daysInProgress(task, history, "2026-10-20")).toEqual({
    count: 3,
    partial: false,
  });
  expect(
    daysInProgress(
      task,
      history,
      "2026-10-19",
      [1, 2, 3, 4, 5],
      ["2026-10-19"],
    ),
  ).toEqual({ count: 1, partial: false });
  expect(daysInProgress(task, history, "2026-10-15")?.count).toBe(0);
});
it("does not double count same-day reopenings and stops at midnight boundaries", () => {
  const changes = [
    history[0],
    event("2026-10-16T06:00:00Z", "planned", "in_progress"),
    event("2026-10-18T18:30:00Z", "in_progress", "blocked"),
    event("2026-10-20T06:00:00Z", "blocked", "in_progress"),
    event("2026-10-20T07:00:00Z", "in_progress", "completed"),
    event("2026-10-20T08:00:00Z", "completed", "in_progress"),
  ];
  expect(daysInProgress(task, changes, "2026-10-20")?.count).toBe(2);
  expect(calendarTasks("2026-10-20", [task], changes)[0].status).toBe(
    "in_progress",
  );
});
it("flags missing history instead of inventing days and respects a scheduled start", () => {
  expect(daysInProgress(task, [], "2026-10-20")).toBeNull();
  expect(daysInProgress(task, history.slice(1), "2026-10-20")?.partial).toBe(
    true,
  );
  expect(
    calendarTasks(
      "2026-10-19",
      [{ ...task, start_date: "2026-10-20" }],
      history,
    ),
  ).toEqual([]);
  expect(dayBounds("2026-10-31")).toEqual([
    "2026-10-31T00:00:00+05:30",
    "2026-11-01T00:00:00+05:30",
  ]);
});

it("projects unfinished tasks across days and months without projecting completions or workday counts", () => {
  const open = { ...task, status: "in_progress", completed_at: null } as Task;
  const changes = history.slice(0, 2);
  for (const date of ["2026-10-21", "2026-10-22", "2026-11-02"]) {
    const entries = calendarTasks(
      date,
      [open, { ...task, id: "done" }],
      changes,
      "2026-10-20",
    );
    expect(entries.map(({ task, status }) => [task.id, status])).toEqual([
      ["task", "in_progress"],
    ]);
    expect(entries[0].task.created_at).toBe(open.created_at);
  }
  expect(
    calendarTasks(
      "2026-10-21",
      [{ ...open, start_date: "2026-10-22" }],
      changes,
      "2026-10-20",
    ),
  ).toEqual([]);
  expect(
    calendarTasks(
      "2026-10-21",
      [{ ...open, status: "cancelled" }],
      changes,
      "2026-10-20",
    ),
  ).toEqual([]);
});
