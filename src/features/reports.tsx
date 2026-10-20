import { useState } from "react";
import { format, startOfMonth, parseISO } from "date-fns";
import { Download, Copy, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  allRows,
  command,
  message,
  useAllRows,
  useCommand,
  type Filter,
} from "../lib/api";
import {
  approvedHours,
  dateLabel,
  rangeSchema,
  today,
  whatsapp,
  statuses,
  label,
} from "../lib/business";
import { exportReport, reportRows, type ExportData } from "../lib/exports";
import { Button } from "../components/ui/button";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  Metrics,
  PageHeader,
} from "../components/shared";
export function ReportsPage() {
  const [start, setStart] = useState(
      format(startOfMonth(parseISO(today())), "yyyy-MM-dd"),
    ),
    [end, setEnd] = useState(today()),
    [developer, setDeveloper] = useState(""),
    [team, setTeam] = useState(""),
    [project, setProject] = useState(""),
    [module, setModule] = useState(""),
    [submission, setSubmission] = useState("approved"),
    [taskStatus, setTaskStatus] = useState(""),
    [style, setStyle] = useState<"person" | "team">("person"),
    [date, setDate] = useState(today()),
    [edited, setEdited] = useState<string | null>(null),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const people = useAllRows("profiles"),
    teams = useAllRows("teams"),
    projects = useAllRows("projects"),
    modules = useAllRows("modules"),
    mutation = useCommand();
  const range = rangeSchema.safeParse({ start, end });
  const filters: Filter[] = [
    { column: "work_date", op: "gte", value: start },
    { column: "work_date", op: "lte", value: end },
    ...Object.entries({
      developer_id: developer,
      team_id: team,
      status: submission,
    })
      .filter(([, v]) => v)
      .map(([column, value]) => ({ column, value })),
  ];
  const logs = useAllRows("daily_work_logs", filters, range.success),
    leaves = useAllRows(
      "leave_requests",
      [
        { column: "starts_on", op: "lte", value: end },
        { column: "ends_on", op: "gte", value: start },
        ...(team ? [{ column: "team_id", value: team }] : []),
        ...(developer ? [{ column: "developer_id", value: developer }] : []),
      ],
      range.success,
    );
  const ids = logs.data?.map((l) => l.id) || [];
  const updates = useQuery({
    queryKey: ["daily_task_updates", "report", ids],
    enabled: !!logs.data,
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < ids.length; i += 100)
        batches.push(
          ...(await allRows("daily_task_updates", [
            { column: "work_log_id", op: "in", value: ids.slice(i, i + 100) },
          ])),
        );
      return batches;
    },
  });
  const filteredUpdates =
      updates.data?.filter(
        (u) =>
          (!project || u.project_id === project) &&
          (!module || u.module_id === module) &&
          (!taskStatus || u.status === taskStatus),
      ) || [],
    filteredLogs =
      logs.data?.filter(
        (l) =>
          !(project || module || taskStatus) ||
          filteredUpdates.some((u) => u.work_log_id === l.id),
      ) || [];
  const data: ExportData = {
    logs: filteredLogs,
    updates: filteredUpdates,
    people: people.data || [],
    teams: teams.data || [],
    projects: projects.data || [],
    modules: modules.data || [],
    leaves: leaves.data || [],
  };
  const preview = whatsapp(
    date,
    style,
    data.logs,
    data.updates,
    data.people,
    data.teams,
  );
  const snapshots = useAllRows("report_snapshots", [
    { column: "report_date", value: date },
    ...(team ? [{ column: "team_id", value: team }] : []),
  ]);
  async function doExport(type: "xlsx" | "csv") {
    setError("");
    setBusy(true);
    try {
      await command("export", { starts_on: start, ends_on: end, format: type });
      await exportReport(data, start, end, type);
      setFeedback(`${type.toUpperCase()} downloaded.`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Reports & exports"
        description="Approved work, daily totals, and a summary ready to share."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={
                busy ||
                !range.success ||
                !logs.data ||
                updates.isPending ||
                !!updates.error
              }
              onClick={() => void doExport("csv")}
            >
              <Download size={16} />
              CSV
            </Button>
            <Button
              disabled={
                busy ||
                !range.success ||
                !logs.data ||
                updates.isPending ||
                !!updates.error
              }
              onClick={() => void doExport("xlsx")}
            >
              <Download size={16} />
              {busy ? "Preparing…" : "Export Excel"}
            </Button>
          </>
        }
      />
      <section className="panel padded">
        <div className="filters">
          <Field label="Start date">
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setEdited(null);
              }}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setEdited(null);
              }}
            />
          </Field>
          <Field label="Team">
            <select
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                setEdited(null);
              }}
            >
              <option value="">All authorized teams</option>
              {teams.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Developer">
            <select
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
            >
              <option value="">All developers</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project">
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Module">
            <select value={module} onChange={(e) => setModule(e.target.value)}>
              <option value="">All modules</option>
              {modules.data
                ?.filter((m) => !project || m.project_id === project)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Submission">
            <select
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
            >
              <option value="">All states (exports approved only)</option>
              {["draft", "submitted", "approved", "revision_requested"].map(
                (s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Task status">
            <select
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value)}
            >
              <option value="">All task statuses</option>
              {statuses.map((s) => (
                <option value={s} key={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!range.success && (
          <p className="field-error" role="alert">
            Choose a valid date range with the end on or after the start.
          </p>
        )}
      </section>
      {error && <ErrorState error={new Error(error)} />}
      {feedback && (
        <p className="success" role="status">
          {feedback}
        </p>
      )}
      {logs.error ||
      updates.error ||
      people.error ||
      teams.error ||
      projects.error ||
      modules.error ||
      leaves.error ? (
        <ErrorState
          error={
            logs.error ||
            updates.error ||
            people.error ||
            teams.error ||
            projects.error ||
            modules.error ||
            leaves.error
          }
        />
      ) : range.success && (logs.isPending || updates.isPending) ? (
        <Loading />
      ) : (
        range.success && (
          <>
            <Metrics
              items={[
                { label: "Approved hours", value: approvedHours(filteredLogs) },
                {
                  label: "Approved daily records",
                  value: filteredLogs.filter((l) => l.status === "approved")
                    .length,
                },
                {
                  label: "Completed task snapshots",
                  value: filteredUpdates.filter((u) => u.status === "completed")
                    .length,
                },
                {
                  label: "Approved leave requests",
                  value: data.leaves.filter((l) => l.status === "approved")
                    .length,
                },
              ]}
            />
            <section className="panel">
              <div className="panel-heading">
                <h2>Daily work records</h2>
                <span className="muted">
                  {start && dateLabel(start)} to {end && dateLabel(end)}
                </span>
              </div>
              {reportRows(data).length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Developer</th>
                        <th>Role</th>
                        <th>Modules</th>
                        <th>Key work</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows(data).map((r, i) => (
                        <tr key={i}>
                          {r.map((cell, j) => (
                            <td key={j} className={j === 4 ? "work-cell" : ""}>
                              {String(cell ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="No approved work in this range">
                  Draft and submitted updates are excluded from exports.
                </Empty>
              )}
            </section>
            <section className="panel padded whatsapp-panel">
              <div className="panel-heading">
                <div>
                  <h2>WhatsApp-ready summary</h2>
                  <p className="muted">
                    Approved updates only. Review edits before sharing.
                  </p>
                </div>
                <Badge value="approved" />
              </div>
              <div className="filters">
                <Field label="Summary date">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setEdited(null);
                    }}
                  />
                </Field>
                <Field label="Summary style">
                  <select
                    value={style}
                    onChange={(e) => {
                      setStyle(e.target.value as "person" | "team");
                      setEdited(null);
                    }}
                  >
                    <option value="person">Person-wise</option>
                    <option value="team">Team-wise</option>
                  </select>
                </Field>
              </div>
              <Field label="Editable message">
                <textarea
                  className="whatsapp-preview"
                  rows={13}
                  value={edited ?? preview}
                  onChange={(e) => setEdited(e.target.value)}
                />
              </Field>
              <div className="dialog-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEdited(null);
                    setFeedback("Preview regenerated from approved records.");
                  }}
                >
                  Regenerate preview
                </Button>
                <Button
                  variant="secondary"
                  disabled={!team || mutation.isPending}
                  onClick={() =>
                    mutation.mutate(
                      {
                        action: "snapshot",
                        payload: {
                          team_id: team,
                          report_date: date,
                          style,
                          body: edited ?? preview,
                        },
                      },
                      {
                        onSuccess: () => setFeedback("Report snapshot saved."),
                      },
                    )
                  }
                >
                  <Save size={16} />
                  Save team snapshot
                </Button>
                <Button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(edited ?? preview)
                      .then(() => setFeedback("Summary copied."))
                      .catch(() =>
                        setError(
                          "Clipboard access failed. Select and copy the message manually.",
                        ),
                      );
                  }}
                >
                  <Copy size={16} />
                  Copy summary
                </Button>
              </div>
              {!team && (
                <small className="muted">
                  Select one team to save a historical snapshot.
                </small>
              )}
              {mutation.error && <ErrorState error={mutation.error} />}
              <details>
                <summary>
                  Saved snapshots for this date ({snapshots.data?.length || 0})
                </summary>
                {snapshots.data?.map((s) => (
                  <div className="snapshot" key={s.id}>
                    <small>
                      {new Date(s.created_at).toLocaleString("en-GB", {
                        timeZone: "Asia/Colombo",
                      })}{" "}
                      · {s.style}
                    </small>
                    <pre>{s.body}</pre>
                  </div>
                ))}
              </details>
            </section>
          </>
        )
      )}
    </>
  );
}
