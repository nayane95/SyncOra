import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { allRows, useAllRows } from "../lib/api";
import { localDate, today } from "../lib/business";
import type { WorkLog } from "../types/database";
import { Empty, ErrorState, Loading } from "../components/shared";
export function Analytics({ logs }: { logs: WorkLog[] }) {
  const [view, setView] = useState("submissions"),
    end = today(),
    start = format(subDays(parseISO(end), 6), "yyyy-MM-dd");
  const completed = useAllRows("tasks", [
      { column: "status", value: "completed" },
      { column: "completed_at", op: "gte", value: `${start}T00:00:00+05:30` },
      { column: "completed_at", op: "lte", value: `${end}T23:59:59.999+05:30` },
    ]),
    teams = useAllRows("teams"),
    projects = useAllRows("projects"),
    leaves = useAllRows("leave_requests", [
      { column: "status", value: "approved" },
      { column: "starts_on", op: "lte", value: end },
      { column: "ends_on", op: "gte", value: start },
    ]);
  const ids = logs.filter((l) => l.status === "approved").map((l) => l.id);
  const updates = useQuery({
    queryKey: ["daily_task_updates", "analytics", ids],
    queryFn: async () => {
      const result = [];
      for (let i = 0; i < ids.length; i += 100)
        result.push(
          ...(await allRows("daily_task_updates", [
            { column: "work_log_id", op: "in", value: ids.slice(i, i + 100) },
          ])),
        );
      return result;
    },
  });
  const days = Array.from({ length: 7 }, (_, i) =>
    format(subDays(parseISO(end), 6 - i), "yyyy-MM-dd"),
  );
  const data =
    view === "teams"
      ? (teams.data || []).map((t) => ({
          name: t.name,
          value: logs.filter((l) => l.team_id === t.id && l.status !== "draft")
            .length,
        }))
      : view === "projects"
        ? (projects.data || []).map((p) => ({
            name: p.name,
            value:
              updates.data?.filter((u) => u.project_id === p.id).length || 0,
          }))
        : days.map((day) => ({
            name: format(parseISO(day), "EEE"),
            value:
              view === "completed"
                ? (completed.data || []).filter(
                    (t) => t.completed_at && localDate(t.completed_at) === day,
                  ).length
                : view === "leave"
                  ? (leaves.data || [])
                      .filter((l) => l.starts_on <= day && l.ends_on >= day)
                      .reduce((n, l) => n + (l.half_day ? 0.5 : 1), 0)
                  : logs.filter(
                      (l) => l.work_date === day && l.status !== "draft",
                    ).length,
          }));
  const title: Record<string, string> = {
    submissions: "Daily submission trend",
    completed: "Task completion trend",
    teams: "Team activity comparison",
    projects: "Project work distribution",
    leave: "Approved leave by date",
  };
  const error =
    completed.error ||
    teams.error ||
    projects.error ||
    leaves.error ||
    updates.error;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title[view]}</h2>
          <p className="muted">Last seven days · authorized records</p>
        </div>
        <select
          aria-label="Analytics view"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          {Object.entries(title).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <ErrorState error={error} />
      ) : completed.isPending || updates.isPending ? (
        <Loading />
      ) : data.length ? (
        <>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={view === "leave"}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    color: "var(--ink)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Bar
                  dataKey="value"
                  name={
                    view === "projects"
                      ? "Task snapshots"
                      : view === "leave"
                        ? "Leave days"
                        : view === "completed"
                          ? "Completed tasks"
                          : "Submitted records"
                  }
                  fill="var(--accent)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">
            {view === "projects"
              ? "Project distribution counts task snapshots from approved records. No hours are allocated twice."
              : "Activity counts describe workflow, not individual productivity."}
          </p>
        </>
      ) : (
        <Empty title="No activity in this period" />
      )}
    </section>
  );
}
