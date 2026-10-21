import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../components/ui/collapsible";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/table";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useValidatedForm } from "../lib/use-validated-form";
import { summarySchema } from "../lib/form-schemas";
import { useState } from "react";
import { format, startOfMonth, parseISO } from "date-fns";
import { Download, Copy, Save, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { allRows, command, message, useAllRows, useCommand } from "../lib/api";
import {
  dateLabel,
  localDate,
  rangeSchema,
  today,
  statuses,
  label,
} from "../lib/business";
import { taskSummary, tasksAtDate } from "../lib/task-summary";
import type { Tables } from "../types/database";
import { exportTaskReport, taskReportHeaders } from "../lib/exports";
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
    [taskStatus, setTaskStatus] = useState(""),
    [style, setStyle] = useState<"person" | "team">("person"),
    [date, setDate] = useState(today()),
    [edited, setEdited] = useState<{ source: string; body: string } | null>(
      null,
    ),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(10);
  const people = useAllRows("profiles"),
    teams = useAllRows("teams"),
    projects = useAllRows("projects"),
    modules = useAllRows("modules"),
    mutation = useCommand();
  const rangeForm = useValidatedForm(rangeSchema, { start, end }, "onChange");
  const range = rangeSchema.safeParse({ start, end });
  const reportTasks = useAllRows(
    "tasks",
    [
      {
        column: "created_at",
        op: "lte",
        value: `${end}T23:59:59.999999+05:30`,
      },
      ...Object.entries({
        team_id: team,
        project_id: project,
        module_id: module,
      })
        .filter(([, value]) => value)
        .map(([column, value]) => ({ column, value })),
    ],
    range.success,
  );
  const reportIds = reportTasks.data?.map((t) => t.id) || [];
  const reportHistory = useQuery({
    queryKey: ["task_status_history", "report", end, reportIds],
    enabled: range.success && !!reportTasks.data,
    queryFn: async () => {
      const result: Tables["task_status_history"][] = [];
      for (let i = 0; i < reportIds.length; i += 100)
        result.push(
          ...(await allRows("task_status_history", [
            { column: "task_id", op: "in", value: reportIds.slice(i, i + 100) },
            {
              column: "created_at",
              op: "lte",
              value: `${end}T23:59:59.999999+05:30`,
            },
          ])),
        );
      return result;
    },
  });
  const data = { people: people.data || [], teams: teams.data || [] };
  const progress = tasksAtDate(end, {
    tasks: reportTasks.data || [],
    history: reportHistory.data || [],
    ...data,
    developer,
    status: taskStatus,
  }).filter(
    (r) =>
      r.status !== "cancelled" &&
      (r.status !== "completed" ||
        (!!r.completion && localDate(r.completion) >= start)),
  );
  const reportValues = progress.map(
    ({ task, status, assignee, completion, blocker }) => [
      `SYNC-${task.task_number}`,
      task.title,
      data.people.find((p) => p.id === assignee)?.name || "Unassigned",
      data.teams.find((t) => t.id === task.team_id)?.name || "Team",
      projects.data?.find((p) => p.id === task.project_id)?.name || "—",
      modules.data?.find((m) => m.id === task.module_id)?.name || "—",
      status === "unknown" ? "Status history unavailable" : label(status),
      localDate(task.created_at),
      status === "completed" && completion ? localDate(completion) : "—",
      blocker,
    ],
  );
  const pageCount = Math.max(1, Math.ceil(reportValues.length / pageSize));
  const reportPage = Math.min(page, pageCount - 1);
  const pageStart = reportPage * pageSize;
  const visibleReport = reportValues.slice(pageStart, pageStart + pageSize);
  const reportError =
    reportTasks.error ||
    reportHistory.error ||
    people.error ||
    teams.error ||
    projects.error ||
    modules.error;
  const reportReady =
    range.success &&
    !reportError &&
    [reportTasks, reportHistory, people, teams, projects, modules].every(
      (q) => !q.isPending && !q.isFetching,
    );
  const summaryDateValid =
    rangeSchema.safeParse({ start: date, end: date }).success &&
    date <= today();
  const summaryTasks = useAllRows(
    "tasks",
    [
      {
        column: "created_at",
        op: "lte",
        value: `${date}T23:59:59.999999+05:30`,
      },
      ...Object.entries({
        team_id: team,
        project_id: project,
        module_id: module,
      })
        .filter(([, value]) => value)
        .map(([column, value]) => ({ column, value })),
    ],
    summaryDateValid,
  );
  const taskIds = summaryTasks.data?.map((t) => t.id) || [];
  const summaryHistory = useQuery({
    queryKey: ["task_status_history", "summary", date, taskIds],
    enabled: summaryDateValid && !!summaryTasks.data,
    queryFn: async () => {
      const result: Tables["task_status_history"][] = [];
      for (let i = 0; i < taskIds.length; i += 100)
        result.push(
          ...(await allRows("task_status_history", [
            { column: "task_id", op: "in", value: taskIds.slice(i, i + 100) },
            {
              column: "created_at",
              op: "lte",
              value: `${date}T23:59:59.999999+05:30`,
            },
          ])),
        );
      return result;
    },
  });
  const summaryError =
    summaryTasks.error || summaryHistory.error || people.error || teams.error;
  const summaryReady =
    summaryDateValid &&
    !summaryError &&
    !summaryTasks.isPending &&
    !summaryHistory.isPending &&
    !summaryTasks.isFetching &&
    !summaryHistory.isFetching &&
    !people.isPending &&
    !teams.isPending;
  const preview = summaryReady
    ? taskSummary(date, style, {
        tasks: summaryTasks.data || [],
        history: summaryHistory.data || [],
        people: data.people,
        teams: data.teams,
        developer,
        status: taskStatus,
      })
    : "";
  const summarySource = JSON.stringify([
    date,
    style,
    team,
    developer,
    project,
    module,
    taskStatus,
    preview,
  ]);
  const summaryBody = edited?.source === summarySource ? edited.body : preview;
  const summaryForm = useValidatedForm(
    summarySchema,
    { date, body: summaryBody },
    "onChange",
  );
  const snapshots = useAllRows(
    "report_snapshots",
    [
      { column: "report_date", value: date },
      ...(team ? [{ column: "team_id", value: team }] : []),
    ],
    summaryDateValid,
  );
  async function doExport(type: "xlsx" | "csv") {
    setError("");
    setBusy(true);
    try {
      await command("export", { starts_on: start, ends_on: end, format: type });
      await exportTaskReport(reportValues, start, end, type);
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
        title="Reports & summaries"
        description="Review task progress, export reports and prepare meeting summaries."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={busy || !reportReady}
              onClick={() => void doExport("csv")}
            >
              <Download size={16} />
              CSV
            </Button>
            <Button
              disabled={busy || !reportReady}
              onClick={() => void doExport("xlsx")}
            >
              <Download size={16} />
              {busy ? "Preparing…" : "Export Excel"}
            </Button>
          </>
        }
      />
      <Card className="panel padded">
        <div className="filters">
          <Field
            label="Start date"
            error={rangeForm.formState.errors.start?.message}
          >
            <Input
              type="date"
              value={start}
              {...rangeForm.register("start", {
                onChange: (e) => {
                  setStart(e.target.value);
                  setPage(0);
                  setEdited(null);
                },
              })}
            />
          </Field>
          <Field
            label="End date"
            error={rangeForm.formState.errors.end?.message}
          >
            <Input
              type="date"
              value={end}
              {...rangeForm.register("end", {
                onChange: (e) => {
                  setEnd(e.target.value);
                  setPage(0);
                  setEdited(null);
                },
              })}
            />
          </Field>
          <Field label="Team">
            <NativeSelect
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                setPage(0);
                setEdited(null);
              }}
            >
              <NativeSelectOption value="">
                All authorized teams
              </NativeSelectOption>
              {teams.data?.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Developer">
            <NativeSelect
              value={developer}
              onChange={(e) => {
                setDeveloper(e.target.value);
                setPage(0);
              }}
            >
              <NativeSelectOption value="">All developers</NativeSelectOption>
              {people.data?.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project">
            <NativeSelect
              value={project}
              onChange={(e) => {
                setProject(e.target.value);
                setPage(0);
              }}
            >
              <NativeSelectOption value="">All projects</NativeSelectOption>
              {projects.data?.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Module">
            <NativeSelect
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setPage(0);
              }}
            >
              <NativeSelectOption value="">All modules</NativeSelectOption>
              {modules.data
                ?.filter((m) => !project || m.project_id === project)
                .map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Task status">
            <NativeSelect
              value={taskStatus}
              onChange={(e) => {
                setTaskStatus(e.target.value);
                setPage(0);
              }}
            >
              <NativeSelectOption value="">
                All task statuses
              </NativeSelectOption>
              {statuses.map((s) => (
                <NativeSelectOption value={s} key={s}>
                  {label(s)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {!range.success && (
          <p className="field-error" role="alert">
            Choose a valid date range with the end on or after the start.
          </p>
        )}
      </Card>
      {error && <ErrorState error={new Error(error)} />}
      {feedback && (
        <p className="success" role="status">
          {feedback}
        </p>
      )}
      {reportError ? (
        <ErrorState error={reportError} />
      ) : range.success && !reportReady ? (
        <Loading />
      ) : (
        range.success && (
          <>
            <Metrics
              items={[
                { label: "Tasks", value: progress.length },
                {
                  label: "In progress",
                  value: progress.filter((r) => r.status === "in_progress")
                    .length,
                },
                {
                  label: "Done in this period",
                  value: progress.filter((r) => r.status === "completed")
                    .length,
                },
                {
                  label: "Blocked",
                  value: progress.filter((r) => r.status === "blocked").length,
                },
              ]}
            />
            <Card className="panel">
              <div className="panel-heading">
                <h2>Task progress report</h2>
                <span className="muted">
                  {start && dateLabel(start)} to {end && dateLabel(end)}
                </span>
              </div>
              <p className="muted padded">
                Open tasks as of the end date and tasks completed during this
                period. Cancelled tasks are excluded. Project and module show
                current values.
              </p>
              {reportValues.length ? (
                <>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Work report, scroll for more columns"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {taskReportHeaders.map((h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleReport.map((r) => (
                          <TableRow key={String(r[0])}>
                            {r.map((cell, j) => (
                              <TableCell
                                key={j}
                                className={j === 4 ? "work-cell" : ""}
                              >
                                {String(cell ?? "-")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <nav
                    className="report-pagination"
                    aria-label="Report pagination"
                  >
                    <p className="muted" role="status">
                      Showing {pageStart + 1}–{pageStart + visibleReport.length}{" "}
                      of {reportValues.length} tasks
                    </p>
                    <div className="report-page-size">
                      <Field label="Rows per page">
                        <NativeSelect
                          value={pageSize}
                          onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setPage(0);
                          }}
                        >
                          {[10, 25, 50, 100].map((limit) => (
                            <NativeSelectOption key={limit} value={limit}>
                              {limit}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                    </div>
                    <div className="pager">
                      <Button
                        variant="secondary"
                        disabled={reportPage === 0}
                        onClick={() => setPage(reportPage - 1)}
                      >
                        Previous
                      </Button>
                      <span>
                        Page {reportPage + 1} of {pageCount}
                      </span>
                      <Button
                        variant="secondary"
                        disabled={reportPage + 1 >= pageCount}
                        onClick={() => setPage(reportPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </nav>
                </>
              ) : (
                <Empty title="No tasks match this report">
                  Try another date range, team or developer.
                </Empty>
              )}
            </Card>
          </>
        )
      )}
      <Card className="panel padded whatsapp-panel">
        <div className="panel-heading">
          <div>
            <h2>WhatsApp-ready summary</h2>
            <p className="muted">
              Task progress as of the selected date, grouped by person or team.
              Review edits before sharing.
            </p>
          </div>
          <Badge value="task_based" />
        </div>
        <div className="filters">
          <Field
            label="Summary date"
            error={
              summaryForm.formState.errors.date?.message ||
              (!summaryDateValid
                ? "Choose a valid summary date up to today."
                : undefined)
            }
          >
            <Input
              type="date"
              max={today()}
              value={date}
              {...summaryForm.register("date", {
                onChange: (e) => {
                  setDate(e.target.value);
                  setEdited(null);
                },
              })}
            />
          </Field>
          <Field label="Summary style">
            <NativeSelect
              value={style}
              onChange={(e) => {
                setStyle(e.target.value as "person" | "team");
                setEdited(null);
              }}
            >
              <NativeSelectOption value="person">
                Person-wise
              </NativeSelectOption>
              <NativeSelectOption value="team">Team-wise</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        {summaryError && <ErrorState error={summaryError} />}
        {summaryDateValid && !summaryError && !summaryReady && <Loading />}
        <Field
          label="Editable message"
          error={
            summaryReady
              ? summaryForm.formState.errors.body?.message
              : undefined
          }
        >
          <Textarea
            className="whatsapp-preview"
            rows={13}
            disabled={!summaryReady}
            value={summaryBody}
            {...summaryForm.register("body", {
              onChange: (e) =>
                setEdited({ source: summarySource, body: e.target.value }),
            })}
          />
        </Field>
        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={!summaryReady}
            onClick={async () => {
              setEdited(null);
              setFeedback("");
              const refreshed = await Promise.all([
                summaryTasks.refetch(),
                summaryHistory.refetch(),
              ]);
              if (refreshed.every((r) => !r.isError))
                setFeedback("Preview regenerated from task history.");
            }}
          >
            Regenerate preview
          </Button>
          <Button
            variant="secondary"
            disabled={!summaryReady || !team || mutation.isPending}
            onClick={summaryForm.handleSubmit(() =>
              mutation.mutate(
                {
                  action: "snapshot",
                  payload: {
                    team_id: team,
                    report_date: date,
                    style,
                    body: summaryBody,
                  },
                },
                {
                  onSuccess: () => setFeedback("Report snapshot saved."),
                },
              ),
            )}
          >
            <Save size={16} />
            Save team snapshot
          </Button>
          <Button
            disabled={!summaryReady}
            onClick={summaryForm.handleSubmit(() => {
              void navigator.clipboard
                .writeText(summaryBody)
                .then(() => setFeedback("Summary copied."))
                .catch(() =>
                  setError(
                    "Clipboard access failed. Select and copy the message manually.",
                  ),
                );
            })}
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
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="history-toggle">
              <ChevronRight aria-hidden="true" size={16} />
              Saved snapshots for this date ({snapshots.data?.length || 0})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </>
  );
}
