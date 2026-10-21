import { dateLabel, label, localDate } from "./business";
import type { Profile, Tables, Task, Team } from "../types/database";

export function tasksAtDate(
  date: string,
  data: {
    tasks: Task[];
    history: Tables["task_status_history"][];
    people: Profile[];
    teams: Team[];
    developer?: string;
    status?: string;
  },
) {
  const result = [];
  for (const task of data.tasks) {
    if (localDate(task.created_at) > date) continue;
    const events = data.history
      .filter((h) => h.task_id === task.id && localDate(h.created_at) <= date)
      .sort(
        (a, b) =>
          Date.parse(b.created_at) - Date.parse(a.created_at) ||
          b.id.localeCompare(a.id),
      );
    const event = events.at(0);
    const status =
      event?.new_status ??
      (localDate(task.updated_at) <= date ? task.status : "unknown");
    const assignee = event ? event.assignee_id : task.assignee_id;
    if (data.developer && assignee !== data.developer) continue;
    if (data.status && status !== data.status) continue;

    const completion =
      events.find(
        (h) => h.new_status === "completed" && h.old_status !== "completed",
      )?.created_at ?? task.completed_at;
    const detail = event?.detail;
    const blocker =
      detail &&
      typeof detail === "object" &&
      !Array.isArray(detail) &&
      typeof detail.blocker === "string"
        ? detail.blocker
        : !event
          ? task.blocker
          : "";
    result.push({ task, status, assignee, completion, blocker });
  }
  return result;
}

export function taskSummary(
  date: string,
  style: "person" | "team",
  data: {
    tasks: Task[];
    history: Tables["task_status_history"][];
    people: Profile[];
    teams: Team[];
    developer?: string;
    status?: string;
  },
) {
  const sections = new Map<string, Map<string, string[]>>();
  for (const { task, status, assignee, completion, blocker } of tasksAtDate(
    date,
    data,
  )) {
    if (status === "cancelled") continue;
    if (
      status === "completed" &&
      (!completion || localDate(completion) !== date)
    )
      continue;
    const person =
      data.people.find((p) => p.id === assignee)?.name || "Unassigned";
    const team = data.teams.find((t) => t.id === task.team_id)?.name || "Team";
    const heading = style === "team" ? team : `${person} (${team})`;
    const group = sections.get(heading) || new Map<string, string[]>();
    const category =
      status === "backlog"
        ? "To do"
        : status === "unknown"
          ? "Status history unavailable"
          : label(status);
    const lines = group.get(category) || [];
    lines.push(
      `- ${style === "team" ? `${person}: ` : ""}SYNC-${task.task_number} ${task.title}${status === "blocked" && blocker ? `\n  Blocker: ${blocker}` : ""}`,
    );
    group.set(category, lines);
    sections.set(heading, group);
  }
  const body = [...sections.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, categories]) =>
      [
        `*${name.replaceAll("*", "")}*`,
        ...[
          "To do",
          "In progress",
          "Blocked",
          "Done",
          "Status history unavailable",
        ].flatMap((status) =>
          categories.has(status)
            ? [`*${status}*`, ...categories.get(status)!]
            : [],
        ),
      ].join("\n"),
    )
    .join("\n\n");
  return `*Team task progress · ${dateLabel(date)}*\n\n${body || "No task progress available for this date and these filters."}`;
}
