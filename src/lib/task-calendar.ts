import { addDays, format, parseISO } from "date-fns";
import { isWorkingDay, localDate } from "./business";
import { tasksAtDate } from "./task-summary";
import type { Tables, Task } from "../types/database";
type History = Tables["task_status_history"];

export function dayBounds(date: string) {
  return [
    `${date}T00:00:00+05:30`,
    `${format(addDays(parseISO(date), 1), "yyyy-MM-dd")}T00:00:00+05:30`,
  ];
}

export function calendarTasks(
  date: string,
  tasks: Task[],
  history: History[],
  asOf = date,
) {
  const projected = date > asOf;
  const entries = projected
    ? tasks.map((task) => ({
        task,
        status: task.status,
        completion: task.completed_at,
      }))
    : tasksAtDate(date, { tasks, history, people: [], teams: [] });
  return entries.filter(({ task, status, completion }) => {
    if (localDate(task.created_at) > date) return false;
    if (task.start_date && task.start_date > date) return false;
    if (projected) return !["completed", "cancelled"].includes(status);
    if (status === "completed")
      return !!completion && localDate(completion) === date;
    if (status === "cancelled") {
      return history.some(
        (h) =>
          h.task_id === task.id &&
          h.new_status === "cancelled" &&
          localDate(h.created_at) === date,
      );
    }
    return true;
  });
}

// Count distinct scheduled workdays with a recorded in-progress interval, not hours worked.
export function daysInProgress(
  task: Task,
  history: History[],
  through: string,
  workingDays = [1, 2, 3, 4, 5],
  holidays: string[] = [],
) {
  const events = history
    .filter((h) => h.task_id === task.id)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  if (!events.length) return null;
  const dates = new Set<string>();
  for (const [i, event] of events.entries()) {
    if (event.new_status !== "in_progress") continue;
    const next = events[i + 1];
    const end = next
      ? localDate(new Date(Date.parse(next.created_at) - 1))
      : through;
    for (
      let date = localDate(event.created_at);
      date <= end && date <= through;
      date = format(addDays(parseISO(date), 1), "yyyy-MM-dd")
    ) {
      if (isWorkingDay(date, workingDays, holidays)) dates.add(date);
    }
  }
  return { count: dates.size, partial: events[0].old_status !== null };
}

export function progressDaysLabel(value: ReturnType<typeof daysInProgress>) {
  return value === null
    ? "Days in progress unavailable"
    : `${value.partial ? "At least " : ""}${value.count} workday${value.count === 1 ? "" : "s"} in progress`;
}
