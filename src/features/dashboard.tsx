import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ArrowUpRight, Sun, Moon, Plus } from "lucide-react";
import { useAuth } from "../app/auth";
import { useAllRows } from "../lib/api";
import {
  approvedHours,
  attendanceFor,
  carryForward,
  dateLabel,
  missingUpdates,
  today,
} from "../lib/business";
import { TaskList } from "./tasks";
import { Analytics } from "./analytics";
import { Button } from "../components/ui/button";
import {
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Loading,
  Metrics,
  PageHeader,
} from "../components/shared";
export function Dashboard() {
  const { profile } = useAuth(),
    admin = profile?.role !== "developer",
    date = today(),
    start = format(subDays(new Date(`${date}T12:00:00`), 6), "yyyy-MM-dd");
  const tasks = useAllRows("tasks", [
      {
        column: "status",
        op: "in",
        value: ["backlog", "planned", "in_progress", "blocked"],
      },
    ]),
    logs = useAllRows("daily_work_logs", [
      { column: "work_date", op: "gte", value: start },
      { column: "work_date", op: "lte", value: date },
    ]),
    people = useAllRows("profiles"),
    leaves = useAllRows("leave_requests", [
      { column: "status", value: "approved" },
      { column: "ends_on", op: "gte", value: date },
      { column: "starts_on", op: "lte", value: date },
    ]),
    calendar = useAllRows("working_calendar_settings"),
    holidays = useAllRows("holidays"),
    memberships = useAllRows("team_memberships", [
      { column: "starts_on", op: "lte", value: date },
    ]);
  const error =
    tasks.error ||
    logs.error ||
    people.error ||
    leaves.error ||
    calendar.error ||
    holidays.error ||
    memberships.error;
  const daily = logs.data?.filter((l) => l.work_date === date) || [],
    active =
      people.data?.filter(
        (p) =>
          p.role === "developer" &&
          p.status === "active" &&
          (profile!.role === "super_admin" ||
            p.id === profile!.id ||
            memberships.data?.some(
              (m) =>
                m.developer_id === p.id && (!m.ends_on || m.ends_on > date),
            )),
      ) || [],
    pending = missingUpdates(
      active,
      daily,
      leaves.data || [],
      date,
      calendar.data?.[0]?.working_days,
      holidays.data?.map((h) => h.holiday_date),
    );
  const chart = Array.from({ length: 7 }, (_, i) => {
    const day = format(
      subDays(new Date(`${date}T12:00:00`), 6 - i),
      "yyyy-MM-dd",
    );
    return {
      day: format(new Date(`${day}T12:00:00`), "EEE"),
      hours: approvedHours(logs.data?.filter((l) => l.work_date === day) || []),
    };
  });
  return (
    <>
      <PageHeader
        eyebrow={dateLabel(date)}
        title={`Good ${new Date().getHours() < 12 ? "morning" : "day"}, ${profile!.name.split(" ")[0]}`}
        description={
          admin
            ? "Here’s where your team stands. Make the next conversation count."
            : "Your work, your updates, and a clear next step."
        }
        actions={
          <Button asChild>
            <Link to={admin ? "/admin/morning-standup" : "/my-updates"}>
              {admin ? <Sun size={17} /> : <Plus size={17} />}
              {admin ? "Start morning standup" : "Write daily update"}
            </Link>
          </Button>
        }
      />
      {tasks.isPending ||
      logs.isPending ||
      people.isPending ||
      memberships.isPending ||
      leaves.isPending ||
      calendar.isPending ||
      holidays.isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <>
          <Metrics
            items={
              admin
                ? [
                    { label: "Active developers", value: active.length },
                    {
                      label: "Today’s submissions",
                      value: daily.filter((l) => l.status !== "draft").length,
                    },
                    { label: "Updates pending", value: pending.length },
                    {
                      label: "Approved hours today",
                      value: approvedHours(daily),
                      note: "Daily totals, counted once",
                    },
                  ]
                : [
                    { label: "Open tasks", value: tasks.data.length },
                    {
                      label: "Carry-forward tasks",
                      value: carryForward(tasks.data, date).length,
                    },
                    {
                      label: "My update",
                      value:
                        daily[0]?.status.replaceAll("_", " ") || "Not started",
                    },
                    {
                      label: "Expected hours",
                      value: attendanceFor(
                        date,
                        leaves.data || [],
                        calendar.data?.[0]?.working_days,
                        holidays.data?.map((h) => h.holiday_date),
                      ).hours,
                    },
                  ]
            }
          />
          {admin && (
            <div className="meeting-shortcuts">
              <Link to="/admin/morning-standup">
                <Sun size={23} />
                <div>
                  <h3>Make a plan for today</h3>
                  <p>Review carry-forward work and confirm assignments.</p>
                </div>
                <ArrowUpRight size={20} />
              </Link>
              <Link to="/admin/evening-standup">
                <Moon size={23} />
                <div>
                  <h3>Bring the day together</h3>
                  <p>Review updates and keep tomorrow in view.</p>
                </div>
                <ArrowUpRight size={20} />
              </Link>
            </div>
          )}
          {admin && <Analytics logs={logs.data} />}
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {admin ? "Work that needs attention" : "Today’s work"}
                  </h2>
                  <p className="muted">
                    {tasks.data.filter((t) => t.status === "blocked").length}{" "}
                    blocked · {carryForward(tasks.data, date).length} carried
                    forward
                  </p>
                </div>
                <Link to={admin ? "/admin/tasks" : "/my-tasks"}>View all</Link>
              </div>
              {tasks.data.length ? (
                <TaskList
                  compact
                  tasks={[...tasks.data]
                    .sort(
                      (a, b) =>
                        Number(b.status === "blocked") -
                        Number(a.status === "blocked"),
                    )
                    .slice(0, 6)}
                />
              ) : (
                <Empty title="No open tasks">
                  {admin
                    ? "Assign your first task to begin the day."
                    : "Your assignments will appear here."}
                </Empty>
              )}
            </section>
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Approved work hours</h2>
                  <p className="muted">Last seven days · daily records</p>
                </div>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chart}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                    <Bar
                      dataKey="hours"
                      fill="var(--accent)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-note">
                Hours describe recorded work. Task counts are not a productivity
                score.
              </p>
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Recent updates</h2>
                <Link to={admin ? "/admin/evening-standup" : "/my-history"}>
                  View updates
                </Link>
              </div>
              {logs.data.length ? (
                logs.data.slice(0, 5).map((l) => (
                  <div className="list-row" key={l.id}>
                    <Avatar
                      name={
                        people.data?.find((p) => p.id === l.developer_id)
                          ?.name || "Team member"
                      }
                    />
                    <div className="grow">
                      <strong>
                        {people.data?.find((p) => p.id === l.developer_id)
                          ?.name || "Team member"}
                      </strong>
                      <p className="muted">
                        {dateLabel(l.work_date)} · {l.hours}h
                      </p>
                    </div>
                    <Badge value={l.status} />
                  </div>
                ))
              ) : (
                <Empty title="No updates this week" />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>{admin ? "Awaiting an update" : "Your next step"}</h2>
                <span className="muted">Today</span>
              </div>
              {admin ? (
                pending.length ? (
                  pending.map((p) => (
                    <div className="list-row" key={p.id}>
                      <Avatar name={p.name} />
                      <strong className="grow">{p.name}</strong>
                      <Badge value="pending" />
                    </div>
                  ))
                ) : (
                  <Empty title="No missing updates">
                    Approved full-day leave and nonworking dates are excluded.
                  </Empty>
                )
              ) : (
                <div className="padded">
                  <p className="muted">
                    Update your task statuses, then submit one daily record
                    covering all your work.
                  </p>
                  <Button asChild variant="secondary">
                    <Link to="/my-updates">Open daily update</Link>
                  </Button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
