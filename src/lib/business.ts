import {
  addDays,
  format,
  parseISO,
  isValid,
  differenceInCalendarDays,
  startOfWeek,
} from "date-fns";
import { z } from "zod";
import type {
  Attendance,
  Leave,
  Task,
  WorkLog,
  TaskUpdate,
  Profile,
  Team,
} from "../types/database";
export const statuses = [
  "backlog",
  "planned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;
export const label = (value: string) =>
  value === "planned"
    ? "To do"
    : value === "completed"
      ? "Done"
      : value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());
export const localDate = (instant: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
export const today = () => localDate(new Date());
export function currentWorkWeek(date = today()) {
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  return [
    format(start, "yyyy-MM-dd") + "T00:00:00+05:30",
    format(addDays(start, 7), "yyyy-MM-dd") + "T00:00:00+05:30",
  ];
}
export const dateLabel = (date: string) =>
  isValid(parseISO(date))
    ? format(parseISO(date), "dd MMM yyyy")
    : "Select a date";
export const dayBefore = (date: string) =>
  format(addDays(parseISO(date), -1), "yyyy-MM-dd");
export function isWorkingDay(
  date: string,
  days = [1, 2, 3, 4, 5],
  holidays: string[] = [],
) {
  return days.includes(parseISO(date).getDay()) && !holidays.includes(date);
}
export function previousWorkday(
  date: string,
  days = [1, 2, 3, 4, 5],
  holidays: string[] = [],
) {
  if (!days.length) throw new Error("Configure at least one working day.");
  let candidate = dayBefore(date);
  for (let i = 0; i < 3660; i++) {
    if (isWorkingDay(candidate, days, holidays)) return candidate;
    candidate = dayBefore(candidate);
  }
  throw new Error("No previous working day found.");
}
export function workingDaysBetween(
  start: string,
  end: string,
  days = [1, 2, 3, 4, 5],
  holidays: string[] = [],
) {
  const count = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  if (!Number.isFinite(count) || count <= 0) return 0;
  const working = [...new Set(days)],
    weeks = Math.floor(count / 7),
    remaining = count % 7,
    first = parseISO(start).getDay();
  let total = weeks * working.length;
  for (let i = 0; i < remaining; i++)
    if (working.includes((first + i) % 7)) total++;
  return (
    total -
    [...new Set(holidays)].filter(
      (h) => h >= start && h <= end && working.includes(parseISO(h).getDay()),
    ).length
  );
}
export function attendanceFor(
  date: string,
  leaves: Leave[],
  days = [1, 2, 3, 4, 5],
  holidays: string[] = [],
): { attendance: Attendance; hours: number } {
  if (holidays.includes(date)) return { attendance: "holiday", hours: 0 };
  if (!days.includes(parseISO(date).getDay()))
    return { attendance: "weekend", hours: 0 };
  const leave = leaves.find(
    (l) => l.status === "approved" && l.starts_on <= date && l.ends_on >= date,
  );
  return leave
    ? {
        attendance: leave.half_day ? "half_day" : "on_leave",
        hours: leave.half_day ? 4 : 0,
      }
    : { attendance: "working", hours: 8 };
}
export const carryForward = (tasks: Task[], date: string) =>
  tasks.filter(
    (t) =>
      localDate(t.created_at) < date &&
      !["completed", "cancelled", "backlog"].includes(t.status),
  );
export const missingUpdates = (
  profiles: Profile[],
  logs: WorkLog[],
  leaves: Leave[],
  date: string,
  days = [1, 2, 3, 4, 5],
  holidays: string[] = [],
) =>
  isWorkingDay(date, days, holidays)
    ? profiles.filter(
        (p) =>
          p.role === "developer" &&
          p.status === "active" &&
          !logs.some(
            (l) =>
              l.developer_id === p.id &&
              l.work_date === date &&
              l.status !== "draft",
          ) &&
          attendanceFor(
            date,
            leaves.filter((l) => l.developer_id === p.id),
            days,
            holidays,
          ).attendance !== "on_leave",
      )
    : [];
export const approvedHours = (logs: WorkLog[]) =>
  logs
    .filter(
      (l) =>
        l.status === "approved" &&
        !["on_leave", "absent"].includes(l.attendance),
    )
    .reduce((n, l) => n + Number(l.hours), 0);
export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a task title").max(300),
    description: z.string().max(10000, "Use 10,000 characters or fewer"),
    team_id: z.string().uuid("Select a team"),
    project_id: z.union([z.literal(""), z.uuid("Select a valid project")]),
    module_id: z.union([z.literal(""), z.uuid("Select a valid module")]),
    assignee_id: z.union([z.literal(""), z.uuid("Select a valid assignee")]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    status: z.enum(statuses),
    target_date: z.union([
      z.literal(""),
      z.iso.date("Select a valid target date"),
    ]),
    blocker: z.string().max(4000, "Use 4,000 characters or fewer"),
    blocker_owner: z
      .union([z.literal(""), z.uuid("Select a valid blocker owner")])
      .optional(),
  })
  .refine((t) => t.status !== "blocked" || t.blocker.trim().length > 0, {
    path: ["blocker"],
    message: "Describe the blocker",
  });
export const leaveSchema = z
  .object({
    leave_type_id: z.string().uuid("Select a leave type"),
    starts_on: z.iso.date("Select a valid start date"),
    ends_on: z.iso.date("Select a valid end date"),
    half_day: z.boolean(),
    reason: z.string().max(2000, "Use 2,000 characters or fewer"),
  })
  .refine((l) => l.ends_on >= l.starts_on, {
    path: ["ends_on"],
    message: "End date must follow start date",
  })
  .refine((l) => !l.half_day || l.starts_on === l.ends_on, {
    path: ["ends_on"],
    message: "Half-day leave must be on one date",
  });
export const rangeSchema = z
  .object({
    start: z.iso.date("Select a valid start date"),
    end: z.iso.date("Select a valid end date"),
  })
  .refine((r) => r.end >= r.start, {
    path: ["end"],
    message: "End date must follow start date",
  });
export function whatsapp(
  date: string,
  style: "person" | "team",
  logs: WorkLog[],
  updates: TaskUpdate[],
  people: Profile[],
  teams: Team[],
) {
  const approved = logs
    .filter((l) => l.status === "approved" && l.work_date === date)
    .sort(
      (a, b) =>
        (a.team_id || "").localeCompare(b.team_id || "") ||
        a.developer_id.localeCompare(b.developer_id),
    );
  const sections: string[] = [];
  const groups =
    style === "person"
      ? approved.map((l) => ({
          name:
            people.find((p) => p.id === l.developer_id)?.name || "Team member",
          logs: [l],
        }))
      : Array.from(new Set(approved.map((l) => l.team_id))).map((id) => ({
          name: teams.find((t) => t.id === id)?.name || "Unassigned team",
          logs: approved.filter((l) => l.team_id === id),
        }));
  for (const group of groups) {
    const lines = [`*${group.name.replaceAll("*", "")}*`];
    for (const log of group.logs) {
      const name =
        people.find((p) => p.id === log.developer_id)?.name || "Team member";
      const prefix = style === "team" ? `${name}: ` : "";
      if (log.attendance === "on_leave") {
        lines.push(`• ${prefix}On leave`);
        continue;
      }
      const items = updates.filter((u) => u.work_log_id === log.id);
      const done = items.filter((u) => u.status === "completed");
      const ongoing = items.filter(
        (u) => !["completed", "cancelled"].includes(u.status),
      );
      if (log.completed_work || done.length)
        lines.push(
          "✅ *Completed*",
          ...done.map((u) => `• ${prefix}${u.title}`),
          ...(log.completed_work ? [`• ${prefix}${log.completed_work}`] : []),
        );
      if (log.remaining_work || ongoing.length)
        lines.push(
          "🚧 *In progress*",
          ...ongoing.map(
            (u) =>
              `• ${prefix}${u.title}${u.status === "blocked" ? " (blocked)" : ""}`,
          ),
          ...(log.remaining_work ? [`• ${prefix}${log.remaining_work}`] : []),
        );
      if (log.blockers) lines.push(`⛔ ${prefix}${log.blockers}`);
      if (log.unplanned_work)
        lines.push(`*Additional work*\n• ${prefix}${log.unplanned_work}`);
    }
    if (lines.length > 1) sections.push(lines.join("\n"));
  }
  return `📅 *Daily Team Progress Update · ${dateLabel(date)}*\n\n${sections.length ? sections.join("\n\n") : "No approved updates for this date."}`;
}
