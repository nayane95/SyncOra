import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Search, ArrowUpRight, MessageSquare } from "lucide-react";
import { useAuth } from "../app/auth";
import { useCommand, useRows, useAllRows, type Filter } from "../lib/api";
import {
  taskSchema,
  statuses,
  label,
  dateLabel,
  localDate,
} from "../lib/business";
import type { Task } from "../types/database";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Pager,
} from "../components/shared";
export function TaskEditor({
  task,
  open,
  onClose,
  defaultTeam = "",
  defaultAssignee = "",
}: {
  task?: Task;
  open: boolean;
  onClose: () => void;
  defaultTeam?: string;
  defaultAssignee?: string;
}) {
  const { profile } = useAuth(),
    mutation = useCommand();
  const admin = profile?.role !== "developer";
  const teams = useAllRows("teams"),
    people = useAllRows("profiles"),
    projects = useAllRows("projects"),
    modules = useAllRows("modules");
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      team_id: task?.team_id || defaultTeam,
      project_id: task?.project_id || "",
      module_id: task?.module_id || "",
      assignee_id:
        task?.assignee_id || defaultAssignee || (!admin ? profile?.id : ""),
      priority: task?.priority || "medium",
      status: task?.status || "planned",
      target_date: task?.target_date || "",
      blocker: task?.blocker || "",
      blocker_owner: task?.blocker_owner || "",
    },
  });
  const project = useWatch({ control: form.control, name: "project_id" });
  const submit = form.handleSubmit(async (values) => {
    const payload =
      task && !admin
        ? {
            id: task.id,
            status: values.status,
            blocker: values.blocker,
            expected_updated_at: task.updated_at,
          }
        : {
            ...values,
            id: task?.id,
            project_id: values.project_id || null,
            module_id: values.module_id || null,
            assignee_id: values.assignee_id || null,
            target_date: values.target_date || null,
            unplanned: !admin,
            blocker_owner: values.blocker_owner || null,
            expected_updated_at: task?.updated_at,
          };
    await mutation
      .mutateAsync({ action: "task", payload })
      .then(onClose)
      .catch(() => {});
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={
        task
          ? `Edit SYNC-${task.task_number}`
          : admin
            ? "Add a task"
            : "Capture unplanned work"
      }
    >
      <form onSubmit={submit} className="form-grid">
        {(admin || !task) && (
          <>
            <Field
              label="Task title"
              error={form.formState.errors.title?.message}
            >
              <input
                autoFocus
                {...form.register("title")}
                placeholder="What needs to be done?"
              />
            </Field>
            <Field label="Description">
              <textarea {...form.register("description")} rows={3} />
            </Field>
            <div className="form-row">
              <Field
                label="Team"
                error={form.formState.errors.team_id?.message}
              >
                <select {...form.register("team_id")}>
                  <option value="">Select team</option>
                  {teams.data
                    ?.filter((t) => !t.archived)
                    .map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Assignee">
                <select {...form.register("assignee_id")} disabled={!admin}>
                  <option value="">Unassigned</option>
                  {people.data
                    ?.filter((p) => p.status === "active")
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Project">
                <select
                  {...form.register("project_id", {
                    onChange: () => form.setValue("module_id", ""),
                  })}
                >
                  <option value="">No project</option>
                  {projects.data
                    ?.filter((p) => !p.archived)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Module">
                <select {...form.register("module_id")}>
                  <option value="">No module</option>
                  {modules.data
                    ?.filter((m) => m.project_id === project && !m.archived)
                    .map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </>
        )}
        <div className="form-row">
          <Field label="Status">
            <select {...form.register("status")}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          {admin && (
            <Field label="Priority">
              <select {...form.register("priority")}>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {admin && (
          <Field label="Target date">
            <input type="date" {...form.register("target_date")} />
          </Field>
        )}
        <Field label="Blocker" error={form.formState.errors.blocker?.message}>
          <textarea
            {...form.register("blocker")}
            placeholder="What is stopping progress?"
            rows={2}
          />
        </Field>
        {admin && (
          <Field label="Blocker owner">
            <select {...form.register("blocker_owner")}>
              <option value="">Not assigned</option>
              {people.data
                ?.filter((p) => p.status === "active")
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function TaskDetail({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const comments = useRows("task_comments", [
      { column: "task_id", value: task.id },
    ]),
    history = useRows("task_status_history", [
      { column: "task_id", value: task.id },
    ]),
    contributors = useAllRows("task_assignees", [
      { column: "task_id", value: task.id },
    ]),
    people = useAllRows("profiles"),
    mutation = useCommand(),
    { profile } = useAuth();
  const [body, setBody] = useState(""),
    [developer, setDeveloper] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`SYNC-${task.task_number} · ${task.title}`}
    >
      <div className="detail-stack">
        <p>{task.description || "No description provided."}</p>
        <div className="toolbar">
          <Badge value={task.status} />
          <Badge value={task.priority} />
        </div>
        {task.blocker && <div className="notice">Blocker: {task.blocker}</div>}
        <h3>Contributors</h3>
        {contributors.data?.map((c) => (
          <div className="list-row" key={c.id}>
            <span>
              {people.data?.find((p) => p.id === c.developer_id)?.name ||
                "Team member"}
            </span>
            {profile?.role !== "developer" && (
              <Button
                variant="ghost"
                onClick={() =>
                  mutation.mutate({
                    action: "contributor",
                    payload: {
                      task_id: task.id,
                      developer_id: c.developer_id,
                      remove: true,
                    },
                  })
                }
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {profile?.role !== "developer" && (
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                action: "contributor",
                payload: { task_id: task.id, developer_id: developer },
              });
            }}
          >
            <label className="sr-only" htmlFor="contributor">
              Contributor
            </label>
            <select
              id="contributor"
              required
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
            >
              <option value="">Select member</option>
              {people.data
                ?.filter((p) => p.status === "active")
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <Button variant="secondary" disabled={mutation.isPending}>
              Add contributor
            </Button>
          </form>
        )}
        <h3>History</h3>
        {history.isPending ? (
          <Loading />
        ) : history.error ? (
          <ErrorState error={history.error} />
        ) : (
          history.data?.map((h) => (
            <div key={h.id} className="history-row">
              <Badge value={h.new_status} />
              <span>
                {dateLabel(localDate(h.created_at))} ·{" "}
                {people.data?.find((p) => p.id === h.actor_id)?.name ||
                  "Team member"}
              </span>
            </div>
          ))
        )}
        <h3>Comments</h3>
        {comments.error && <ErrorState error={comments.error} />}
        {comments.data?.length ? (
          comments.data.map((c) => (
            <div className="comment" key={c.id}>
              <strong>
                {people.data?.find((p) => p.id === c.author_id)?.name ||
                  "Team member"}
              </strong>
              <p>{c.body}</p>
            </div>
          ))
        ) : (
          <p className="muted">No comments yet.</p>
        )}
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              { action: "comment", payload: { task_id: task.id, body } },
              { onSuccess: () => setBody("") },
            );
          }}
        >
          <Field label="Add a comment">
            <textarea
              required
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <Button disabled={mutation.isPending || !body.trim()}>
            Post comment
          </Button>
        </form>
        {mutation.error && <ErrorState error={mutation.error} />}
      </div>
    </Dialog>
  );
}
export function TaskList({
  tasks,
  compact = false,
}: {
  tasks: Task[];
  compact?: boolean;
}) {
  const [editing, setEditing] = useState<Task>(),
    [detail, setDetail] = useState<Task>();
  const people = useAllRows("profiles"),
    projects = useAllRows("projects"),
    mutation = useCommand();
  return (
    <>
      <div className="task-list">
        {tasks.map((t) => (
          <article className="task-row" key={t.id}>
            <div
              className={`priority-mark priority-${t.priority}`}
              title={`${t.priority} priority`}
            />
            <div className="task-main">
              <div className="task-meta">
                <span>SYNC-{t.task_number}</span>
                <span>
                  {projects.data?.find((p) => p.id === t.project_id)?.name ||
                    "General work"}
                </span>
                {t.unplanned && <span>Unplanned</span>}
              </div>
              <button className="task-title" onClick={() => setDetail(t)}>
                {t.title}
              </button>
              {t.blocker && t.status === "blocked" && (
                <p className="blocker-text">{t.blocker}</p>
              )}
              <div className="task-meta">
                <span>
                  {people.data?.find((p) => p.id === t.assignee_id)?.name ||
                    "Unassigned"}
                </span>
                {t.target_date && <span>Due {dateLabel(t.target_date)}</span>}
              </div>
            </div>
            <div className="task-actions">
              <select
                aria-label={`Status for SYNC-${t.task_number}`}
                value={t.status}
                disabled={mutation.isPending}
                onChange={(e) => {
                  if (e.target.value === "blocked") {
                    setEditing({ ...t, status: "blocked" });
                    return;
                  }
                  mutation.mutate({
                    action: "task",
                    payload: {
                      id: t.id,
                      status: e.target.value,
                      expected_updated_at: t.updated_at,
                    },
                  });
                }}
              >
                {statuses.map((s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size={compact ? "icon" : "sm"}
                aria-label={`Edit ${t.title}`}
                onClick={() => setEditing(t)}
              >
                {compact ? <ArrowUpRight size={18} /> : "Update"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Discuss ${t.title}`}
                onClick={() => setDetail(t)}
              >
                <MessageSquare size={16} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {mutation.error && <ErrorState error={mutation.error} />}
      {editing && (
        <TaskEditor
          key={editing.id}
          task={editing}
          open
          onClose={() => setEditing(undefined)}
        />
      )}
      {detail && (
        <TaskDetail task={detail} onClose={() => setDetail(undefined)} />
      )}
    </>
  );
}
export function TasksPage({ mine = false }: { mine?: boolean }) {
  const { profile } = useAuth();
  const [status, setStatus] = useState(""),
    [team, setTeam] = useState(""),
    [project, setProject] = useState(""),
    [module, setModule] = useState(""),
    [assignee, setAssignee] = useState(""),
    [priority, setPriority] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [bulkStatus, setBulkStatus] = useState("planned"),
    [bulkAssignee, setBulkAssignee] = useState("");
  const filters: Filter[] = [
    ...(mine
      ? [{ column: "assignee_id", op: "assigned" as const, value: profile!.id }]
      : []),
    ...(search
      ? [{ column: "title", op: "search" as const, value: search }]
      : []),
    ...Object.entries({
      status,
      team_id: team,
      project_id: project,
      module_id: module,
      assignee_id: assignee,
      priority,
    })
      .filter(([, v]) => v)
      .map(([column, value]) => ({ column, value })),
  ];
  const tasks = useRows("tasks", filters, page),
    teams = useAllRows("teams"),
    projects = useAllRows("projects"),
    modules = useAllRows("modules"),
    people = useAllRows("profiles"),
    mutation = useCommand();
  const filtered = tasks.data || [];
  const change =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(0);
      setSelected([]);
    };
  return (
    <>
      <PageHeader
        title={mine ? "My tasks" : "Task register"}
        description="A single home for work, from first assignment to completion."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus size={17} />
            {mine ? "Add unplanned work" : "Add task"}
          </Button>
        }
      />
      <div className="panel filter-panel">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Search by ID, title or description…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              setSelected([]);
            }}
          />
        </div>
        <div className="filters">
          <select
            aria-label="Filter status"
            value={status}
            onChange={change(setStatus)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter team"
            value={team}
            onChange={change(setTeam)}
          >
            <option value="">All teams</option>
            {teams.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter project"
            value={project}
            onChange={change(setProject)}
          >
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter module"
            value={module}
            onChange={change(setModule)}
          >
            <option value="">All modules</option>
            {modules.data
              ?.filter((m) => !project || m.project_id === project)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          {!mine && (
            <select
              aria-label="Filter developer"
              value={assignee}
              onChange={change(setAssignee)}
            >
              <option value="">All developers</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filter priority"
            value={priority}
            onChange={change(setPriority)}
          >
            <option value="">All priorities</option>
            {["low", "medium", "high", "urgent"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      {!mine && (
        <div className="bulk-toolbar">
          <span>{selected.length} selected</span>
          <select
            aria-label="Bulk status"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            {statuses
              .filter((s) => s !== "blocked")
              .map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
          </select>
          <Button
            variant="secondary"
            disabled={!selected.length || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                {
                  action: "bulk_tasks",
                  payload: {
                    tasks: tasks.data
                      ?.filter((t) => selected.includes(t.id))
                      .map((t) => ({
                        id: t.id,
                        status: bulkStatus,
                        expected_updated_at: t.updated_at,
                      })),
                  },
                },
                { onSuccess: () => setSelected([]) },
              )
            }
          >
            Apply status
          </Button>
          <select
            aria-label="Bulk assignee"
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {people.data
              ?.filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <Button
            variant="secondary"
            disabled={!selected.length || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                {
                  action: "bulk_tasks",
                  payload: {
                    tasks: tasks.data
                      ?.filter((t) => selected.includes(t.id))
                      .map((t) => ({
                        id: t.id,
                        assignee_id: bulkAssignee || null,
                        expected_updated_at: t.updated_at,
                      })),
                  },
                },
                { onSuccess: () => setSelected([]) },
              )
            }
          >
            Assign
          </Button>
        </div>
      )}
      {mutation.error && <ErrorState error={mutation.error} />}
      <section className="panel">
        <div className="panel-heading">
          <h2>{mine ? "Assigned to you" : "All work"}</h2>
          <span className="muted">{filtered.length} on this page</span>
        </div>
        {tasks.isPending ? (
          <Loading />
        ) : tasks.error ? (
          <ErrorState error={tasks.error} retry={() => void tasks.refetch()} />
        ) : filtered.length ? (
          <>
            {!mine && (
              <div className="selection-list">
                {filtered.map((t) => (
                  <label key={t.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(t.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, t.id]
                            : selected.filter((id) => id !== t.id),
                        )
                      }
                    />
                    SYNC-{t.task_number}
                  </label>
                ))}
              </div>
            )}
            <TaskList tasks={filtered} />
          </>
        ) : (
          <Empty title="No tasks match">Add work or adjust your filters.</Empty>
        )}
      </section>
      <Pager page={page} setPage={setPage} count={tasks.data?.length || 0} />
      {create && (
        <TaskEditor open onClose={() => setCreate(false)} defaultTeam={team} />
      )}
    </>
  );
}
