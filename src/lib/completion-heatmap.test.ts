import { expect, it } from "vitest";
import { completionHeatmap } from "./completion-heatmap";
import type { Tables, Task } from "../types/database";
it("counts distinct completions per Colombo day and preserves historical owner after reopening", () => {
  const event = (id: string, date: string, assignee_id = "dev") =>
    ({
      task_id: id,
      created_at: date,
      assignee_id,
      new_status: "completed",
      old_status: "in_progress",
    }) as Tables["task_status_history"];
  const history = [
    event("reopened", "2026-10-19T18:30:00Z"),
    event("reopened", "2026-10-20T10:00:00Z"),
    event("reopened", "2026-10-21T06:00:00Z"),
    event("other", "2026-10-20T10:00:00Z", "other"),
    event("future", "2026-10-22T06:00:00Z"),
  ];
  const tasks = [
    {
      id: "legacy",
      assignee_id: "dev",
      status: "completed",
      completed_at: "2026-10-20T10:00:00Z",
    },
    {
      id: "other",
      assignee_id: "dev",
      status: "completed",
      completed_at: "2026-10-20T10:00:00Z",
    },
  ] as Task[];
  const days = completionHeatmap("dev", "2026-10-21", tasks, history);
  expect(days.find((day) => day.date === "2026-10-20")?.count).toBe(2);
  expect(days.find((day) => day.date === "2026-10-21")?.count).toBe(1);
  expect(days.filter((day) => day.included)).toHaveLength(365);
  expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(3);
  expect(
    completionHeatmap("nobody", "2026-10-21", tasks, history).every(
      (day) => day.count === 0,
    ),
  ).toBe(true);
});
