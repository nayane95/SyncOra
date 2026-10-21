import {
  addDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { localDate } from "./business";
import type { Tables, Task } from "../types/database";

export function completionHeatmap(
  developer: string,
  today: string,
  tasks: Task[],
  history: Tables["task_status_history"][],
) {
  const first = format(subDays(parseISO(today), 364), "yyyy-MM-dd");
  const counts = new Map<string, Set<string>>();
  const add = (date: string, id: string) => {
    if (date < first || date > today) return;
    const ids = counts.get(date) || new Set<string>();
    ids.add(id);
    counts.set(date, ids);
  };
  for (const event of history) {
    if (
      event.assignee_id === developer &&
      event.new_status === "completed" &&
      event.old_status !== "completed"
    )
      add(localDate(event.created_at), event.task_id);
  }
  const recorded = new Set(
    history
      .filter((event) => event.new_status === "completed")
      .map((event) => event.task_id),
  );
  for (const task of tasks) {
    if (
      !recorded.has(task.id) &&
      task.assignee_id === developer &&
      task.status === "completed" &&
      task.completed_at
    )
      add(localDate(task.completed_at), task.id);
  }
  const start = startOfWeek(parseISO(first), { weekStartsOn: 1 });
  const end = addDays(startOfWeek(parseISO(today), { weekStartsOn: 1 }), 6);
  return eachDayOfInterval({ start, end }).map((day) => {
    const date = format(day, "yyyy-MM-dd");
    return {
      date,
      count: counts.get(date)?.size || 0,
      included: date >= first && date <= today,
    };
  });
}
