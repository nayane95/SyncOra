import { TaskSearchCommand } from "./task-search-command";
import { useSearchQuery } from "../lib/use-search-query";
import { DeveloperCompletionHeatmap } from "../components/developer-completion-heatmap";
import { TaskStatusPicker } from "../components/ui/task-status-picker";
import { daysInProgress, progressDaysLabel } from "../lib/task-calendar";
import { useBusinessDate } from "../lib/use-business-date";
import { Checkbox } from "../components/ui/checkbox";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Card } from "../components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { useValidatedForm } from "../lib/use-validated-form";
import { contributorSchema, commentSchema } from "../lib/form-schemas";
import { useEffect, useState, type ReactNode } from "react";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Plus,
  Search,
  ArrowUpRight,
  MessageSquare,
  GripVertical,
  ArrowRight,
  Clock3,
} from "lucide-react";
import { useAuth } from "../app/auth";
import {
  useCommand,
  useRows,
  useAllRows,
  useTaskSearch,
  type Filter,
} from "../lib/api";
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
  ProjectTag,
  Avatar,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
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
    projectScope = useAllRows("project_memberships"),
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
  const selected = useWatch({ control: form.control });
  const project = useWatch({ control: form.control, name: "project_id" });
  const selectedTeam = useWatch({ control: form.control, name: "team_id" });
  const selectedStatus = useWatch({ control: form.control, name: "status" });
  useEffect(() => {
    const available = teams.data?.filter((t) => !t.archived);
    if (!task && !selectedTeam && available?.length === 1)
      form.setValue("team_id", available[0].id);
  }, [teams.data, task, selectedTeam, form]);
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
            unplanned: false,
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
            : "Add my task"
      }
      description={
        admin
          ? undefined
          : "Add your work, then change its status as you make progress. Your team can see it in standups."
      }
    >
      <form noValidate onSubmit={submit} className="form-grid">
        {(admin || !task) && (
          <>
            <Field
              label="Task title"
              error={form.formState.errors.title?.message}
            >
              <Input
                autoFocus
                {...form.register("title")}
                placeholder="What needs to be done?"
              />
            </Field>
            {admin && (
              <Field
                label="Description"
                error={form.formState.errors.description?.message}
              >
                <Textarea {...form.register("description")} rows={3} />
              </Field>
            )}
            <div className="form-row">
              <Field
                label="Team"
                error={form.formState.errors.team_id?.message}
              >
                <NativeSelect
                  value={selected.team_id ?? ""}
                  {...form.register("team_id", {
                    onChange: () => {
                      form.setValue("project_id", "");
                      form.setValue("module_id", "");
                    },
                  })}
                >
                  <NativeSelectOption value="">Select team</NativeSelectOption>
                  {teams.data
                    ?.filter((t) => !t.archived)
                    .map((t) => (
                      <NativeSelectOption value={t.id} key={t.id}>
                        {t.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              {admin && (
                <Field
                  label="Assignee"
                  error={form.formState.errors.assignee_id?.message}
                >
                  <NativeSelect
                    value={selected.assignee_id ?? ""}
                    {...form.register("assignee_id")}
                    disabled={!admin}
                  >
                    <NativeSelectOption value="">Unassigned</NativeSelectOption>
                    {people.data
                      ?.filter((p) => p.status === "active")
                      .map((p) => (
                        <NativeSelectOption value={p.id} key={p.id}>
                          {p.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
            <div className="form-row">
              <Field
                label="Project"
                error={form.formState.errors.project_id?.message}
              >
                <NativeSelect
                  disabled={
                    !selectedTeam ||
                    projects.isPending ||
                    (profile?.role !== "super_admin" &&
                      (projectScope.isPending || !!projectScope.error))
                  }
                  value={selected.project_id ?? ""}
                  {...form.register("project_id", {
                    onChange: () => form.setValue("module_id", ""),
                  })}
                >
                  <NativeSelectOption value="">No project</NativeSelectOption>
                  {projects.data
                    ?.filter(
                      (p) =>
                        !p.archived &&
                        (profile?.role === "super_admin" ||
                          projectScope.data?.some(
                            (s) =>
                              s.project_id === p.id &&
                              s.team_id === selectedTeam,
                          )),
                    )
                    .map((p) => (
                      <NativeSelectOption value={p.id} key={p.id}>
                        {p.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              {admin && (
                <Field
                  label="Module"
                  error={form.formState.errors.module_id?.message}
                >
                  <NativeSelect
                    value={selected.module_id ?? ""}
                    {...form.register("module_id")}
                  >
                    <NativeSelectOption value="">No module</NativeSelectOption>
                    {modules.data
                      ?.filter((m) => m.project_id === project && !m.archived)
                      .map((m) => (
                        <NativeSelectOption value={m.id} key={m.id}>
                          {m.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
          </>
        )}
        <div className="form-row">
          <Field label="Status" error={form.formState.errors.status?.message}>
            <NativeSelect
              value={selected.status ?? ""}
              {...form.register("status")}
            >
              {(admin
                ? statuses
                : [
                    ...new Set([
                      "planned",
                      "in_progress",
                      "completed",
                      "blocked",
                      ...(task ? [task.status] : []),
                    ]),
                  ]
              ).map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {label(s)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {admin && (
            <Field
              label="Priority"
              error={form.formState.errors.priority?.message}
            >
              <NativeSelect
                value={selected.priority ?? ""}
                {...form.register("priority")}
              >
                {["low", "medium", "high", "urgent"].map((p) => (
                  <NativeSelectOption key={p}>{p}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        {admin && (
          <Field
            label="Target date"
            error={form.formState.errors.target_date?.message}
          >
            <Input type="date" {...form.register("target_date")} />
          </Field>
        )}
        {(admin || selectedStatus === "blocked") && (
          <Field label="Blocker" error={form.formState.errors.blocker?.message}>
            <Textarea
              {...form.register("blocker")}
              placeholder="What is stopping progress?"
              rows={2}
            />
          </Field>
        )}
        {admin && (
          <Field
            label="Blocker owner"
            error={form.formState.errors.blocker_owner?.message}
          >
            <NativeSelect
              value={selected.blocker_owner ?? ""}
              {...form.register("blocker_owner")}
            >
              <NativeSelectOption value="">Not assigned</NativeSelectOption>
              {people.data
                ?.filter((p) => p.status === "active")
                .map((p) => (
                  <NativeSelectOption value={p.id} key={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </Field>
        )}
        {(projects.error || projectScope.error) && (
          <ErrorState error={projects.error || projectScope.error} />
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
function taskTimestamp(value: string) {
  return `${dateLabel(localDate(value))} · ${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`;
}
export function TaskDetail({
  task,
  onClose,
  contextDate,
}: {
  task: Task;
  onClose: () => void;
  contextDate?: string;
}) {
  const comments = useRows("task_comments", [
      { column: "task_id", value: task.id },
    ]),
    history = useAllRows("task_status_history", [
      { column: "task_id", value: task.id },
    ]),
    contributors = useAllRows("task_assignees", [
      { column: "task_id", value: task.id },
    ]),
    people = useAllRows("profiles"),
    mutation = useCommand(),
    { profile } = useAuth();
  const businessDate = useBusinessDate();
  const calendarSettings = useAllRows("working_calendar_settings");
  const holidays = useAllRows("holidays");
  const progressDays =
    history.isPending || calendarSettings.isPending || holidays.isPending
      ? "Loading day tracking…"
      : history.error || calendarSettings.error || holidays.error
        ? "Day tracking unavailable"
        : progressDaysLabel(
            daysInProgress(
              task,
              history.data || [],
              businessDate,
              calendarSettings.data?.[0]?.working_days,
              holidays.data?.map((h) => h.holiday_date),
            ),
          );
  const [body, setBody] = useState(""),
    [developer, setDeveloper] = useState("");
  const commentForm = useValidatedForm(commentSchema, { body });
  const contributorForm = useValidatedForm(contributorSchema, { developer });
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      side
      description={
        contextDate
          ? `Current task details · selected day ${dateLabel(contextDate)}. Activity preserves past status changes.`
          : "Task details, collaborators and conversation."
      }
      title={`SYNC-${task.task_number} · ${task.title}`}
    >
      <div className="detail-stack task-detail-content">
        <section aria-label="Task overview" className="task-detail-section">
          <dl className="task-properties">
            <div>
              <dt>Status</dt>
              <dd>
                <Badge value={task.status} />
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <Badge value={task.priority} />
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{dateLabel(localDate(task.created_at))}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>
                {task.target_date ? dateLabel(task.target_date) : "No due date"}
              </dd>
            </div>
            <div>
              <dt>Days in progress</dt>
              <dd title="Distinct configured workdays with recorded In progress time. Weekends and holidays are excluded; this is not an hours log.">
                {progressDays}
              </dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>
                <span className="task-detail-person">
                  <Avatar
                    name={
                      people.data?.find((p) => p.id === task.assignee_id)
                        ?.name || "Unassigned"
                    }
                    src={
                      people.data?.find((p) => p.id === task.assignee_id)
                        ?.avatar_url || undefined
                    }
                  />
                  {people.data?.find((p) => p.id === task.assignee_id)?.name ||
                    "Unassigned"}
                </span>
              </dd>
            </div>
          </dl>
        </section>
        <section
          className="task-detail-section"
          aria-labelledby="task-description-heading"
        >
          <h3 id="task-description-heading">Description</h3>
          <p className={task.description ? "task-description" : "muted"}>
            {task.description || "No description added yet."}
          </p>
        </section>
        {task.blocker && <div className="notice">Blocker: {task.blocker}</div>}
        <section
          className="task-detail-section"
          aria-labelledby="task-contributors-heading"
        >
          <h3 id="task-contributors-heading">Contributors</h3>
          {!contributors.isPending &&
            !contributors.error &&
            !contributors.data?.length && (
              <p className="muted">No additional collaborators.</p>
            )}
          {contributors.data?.map((c) => (
            <div className="task-contributor-row" key={c.id}>
              <span className="task-detail-person">
                <Avatar
                  name={
                    people.data?.find((p) => p.id === c.developer_id)?.name ||
                    "Team member"
                  }
                  src={
                    people.data?.find((p) => p.id === c.developer_id)
                      ?.avatar_url || undefined
                  }
                />
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
              className="task-contributor-form"
              noValidate
              onSubmit={contributorForm.handleSubmit(() => {
                mutation.mutate({
                  action: "contributor",
                  payload: { task_id: task.id, developer_id: developer },
                });
              })}
            >
              <Field
                label="Contributor"
                error={contributorForm.formState.errors.developer?.message}
              >
                <NativeSelect
                  id="contributor"
                  required
                  value={developer}
                  {...contributorForm.register("developer", {
                    onChange: (e) => setDeveloper(e.target.value),
                  })}
                >
                  <NativeSelectOption value="">
                    Select member
                  </NativeSelectOption>
                  {people.data
                    ?.filter((p) => p.status === "active")
                    .map((p) => (
                      <NativeSelectOption value={p.id} key={p.id}>
                        {p.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              <Button variant="secondary" disabled={mutation.isPending}>
                Add contributor
              </Button>
            </form>
          )}
          {contributors.isPending && <Loading />}
          {contributors.error && <ErrorState error={contributors.error} />}
        </section>
        <Tabs defaultValue="comments" className="task-detail-tabs">
          <TabsList>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="history">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="history">
            <div className="task-activity-heading">
              <h3>History</h3>
              <span className="muted">Newest first</span>
            </div>
            {history.isPending ? (
              <Loading />
            ) : history.error ? (
              <ErrorState error={history.error} />
            ) : history.data?.length ? (
              <ol
                className="task-timeline"
                aria-label="Task history, newest first"
              >
                {[...history.data]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((h) => (
                    <li key={h.id} className="task-timeline-event">
                      <span className="task-timeline-marker" aria-hidden="true">
                        <Clock3 size={14} />
                      </span>
                      <div className="task-timeline-body">
                        <p>
                          <strong>
                            {people.data?.find((p) => p.id === h.actor_id)
                              ?.name || "Team member"}
                          </strong>{" "}
                          {h.old_status
                            ? "changed the status"
                            : "created the task"}
                        </p>
                        <div className="task-status-change">
                          {h.old_status && (
                            <>
                              <Badge value={h.old_status} />
                              <ArrowRight size={14} aria-label="to" />
                            </>
                          )}
                          <Badge value={h.new_status} />
                        </div>
                        <time dateTime={h.created_at}>
                          {taskTimestamp(h.created_at)} · Colombo
                        </time>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="muted">No status changes recorded yet.</p>
            )}
          </TabsContent>
          <TabsContent value="comments">
            <h3>Comments</h3>
            {comments.isPending && <Loading />}
            {comments.error && <ErrorState error={comments.error} />}
            {comments.data?.length
              ? comments.data.map((c) => (
                  <article className="task-comment" key={c.id}>
                    <Avatar
                      name={
                        people.data?.find((p) => p.id === c.author_id)?.name ||
                        "Team member"
                      }
                      src={
                        people.data?.find((p) => p.id === c.author_id)
                          ?.avatar_url || undefined
                      }
                    />
                    <div>
                      <strong>
                        {people.data?.find((p) => p.id === c.author_id)?.name ||
                          "Team member"}
                      </strong>
                      <time dateTime={c.created_at}>
                        {taskTimestamp(c.created_at)}
                      </time>
                      <p>{c.body}</p>
                    </div>
                  </article>
                ))
              : !comments.isPending &&
                !comments.error && (
                  <p className="muted task-comments-empty">
                    No comments yet. Share an update or ask a question.
                  </p>
                )}
            <form
              className="form-grid task-comment-form"
              noValidate
              onSubmit={commentForm.handleSubmit((values) => {
                mutation.mutate(
                  {
                    action: "comment",
                    payload: { task_id: task.id, body: values.body },
                  },
                  { onSuccess: () => setBody("") },
                );
              })}
            >
              <Field
                label="Add a comment"
                error={commentForm.formState.errors.body?.message}
              >
                <Textarea
                  required
                  maxLength={4000}
                  rows={3}
                  placeholder="Share progress, context or a question…"
                  value={body}
                  {...commentForm.register("body", {
                    onChange: (e) => setBody(e.target.value),
                  })}
                />
              </Field>
              <div className="task-comment-actions">
                <span className="muted">
                  Visible to people with access to this task.
                </span>
                <Button disabled={mutation.isPending}>Post comment</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
        {mutation.error && <ErrorState error={mutation.error} />}
      </div>
    </Dialog>
  );
}
const taskStages: {
  title: string;
  status: Task["status"];
  states: Task["status"][];
  description: string;
}[] = [
  {
    title: "To do",
    status: "planned",
    states: ["backlog", "planned"],
    description: "Ready when you are",
  },
  {
    title: "In progress",
    status: "in_progress",
    states: ["in_progress", "blocked"],
    description: "What you’re working on",
  },
  {
    title: "Done",
    status: "completed",
    states: ["completed"],
    description: "Completed today",
  },
];

function DraggableTask({
  task,
  disabled,
  children,
}: {
  task: Task;
  disabled: boolean;
  children: ReactNode;
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `SYNC-${task.task_number}`,
    type: "task",
    data: { preview: children },
    disabled,
  });
  return (
    <Card
      ref={ref}
      data-task-key={`SYNC-${task.task_number}`}
      className={`task-row ${isDragging ? "is-card-dragging" : ""}`}
    >
      <Button
        variant="ghost"
        ref={handleRef}
        type="button"
        className="task-drag-handle"
        disabled={disabled}
        aria-label={`Move SYNC-${task.task_number}. Press Space to pick up, arrow keys to move, Space to drop, or Escape to cancel.`}
      >
        <GripVertical size={18} aria-hidden="true" />
      </Button>
      {children}
    </Card>
  );
}

function TaskRow({
  task,
  draggable,
  disabled,
  children,
}: {
  task: Task;
  draggable: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return draggable ? (
    <DraggableTask task={task} disabled={disabled}>
      {children}
    </DraggableTask>
  ) : (
    <Card className="task-row">{children}</Card>
  );
}

function TaskColumn({
  stage,
  count,
  disabled,
  children,
}: {
  stage: (typeof taskStages)[number];
  count: number;
  disabled: boolean;
  children: ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: stage.status,
    accept: "task",
    disabled,
  });
  return (
    <Card
      ref={ref}
      className={`panel board-column board-${stage.status} ${isDropTarget ? "is-drop-target" : ""}`}
      role="region"
      aria-label={`${stage.title} tasks`}
    >
      <div className="panel-heading">
        <div>
          <h2>{stage.title}</h2>
          <p className="muted">{stage.description}</p>
        </div>
        <span className="board-count">{count}</span>
      </div>
      {children}
      {!count && (
        <p className="group-empty">
          {stage.title === "To do"
            ? "Add your next task to get started."
            : "Move work here as you make progress."}
        </p>
      )}
    </Card>
  );
}

export function TaskList({
  tasks,
  compact = false,
  draggable = false,
  disabled = false,
  selection,
  activity,
}: {
  tasks: Task[];
  activity?: { date: string; days: Record<string, string> };
  compact?: boolean;
  draggable?: boolean;
  disabled?: boolean;
  selection?: { ids: string[]; setIds: (ids: string[]) => void };
}) {
  const { profile } = useAuth();
  const [editing, setEditing] = useState<Task>(),
    [detail, setDetail] = useState<Task>();
  const people = useAllRows("profiles"),
    projects = useAllRows("projects"),
    mutation = useCommand();
  return (
    <>
      <div className={selection ? "task-list register-list" : "task-list"}>
        {tasks.map((t) => (
          <TaskRow
            task={t}
            draggable={draggable}
            disabled={disabled || mutation.isPending}
            key={t.id}
          >
            {selection && (
              <Checkbox
                aria-label={`Select SYNC-${t.task_number}: ${t.title}`}
                checked={selection.ids.includes(t.id)}
                onCheckedChange={(checked) =>
                  selection.setIds(
                    checked === true
                      ? [...selection.ids, t.id]
                      : selection.ids.filter((id) => id !== t.id),
                  )
                }
              />
            )}
            <div
              className={`priority-mark priority-${t.priority}`}
              title={`${t.priority} priority`}
            />
            <div className="task-main">
              <div className="task-card-heading">
                <div className="task-meta">
                  <span>SYNC-{t.task_number}</span>
                  {t.project_id ? (
                    <ProjectTag
                      id={t.project_id}
                      name={
                        projects.data?.find((p) => p.id === t.project_id)
                          ?.name || "Project"
                      }
                    />
                  ) : (
                    <span>General work</span>
                  )}
                  {t.unplanned && <span>Unplanned</span>}
                </div>
                {!selection && (
                  <TaskStatusPicker
                    taskNumber={t.task_number}
                    value={t.status}
                    developer={profile?.role === "developer"}
                    disabled={disabled || mutation.isPending}
                    onChange={(status) => {
                      if (status === "blocked") {
                        setEditing({ ...t, status: "blocked" });
                        return;
                      }
                      mutation.mutate({
                        action: "task",
                        payload: {
                          id: t.id,
                          status,
                          expected_updated_at: t.updated_at,
                        },
                      });
                    }}
                  />
                )}
              </div>
              <Button
                variant="ghost"
                className="task-title"
                onClick={() => setDetail(t)}
              >
                {t.title}
              </Button>
              {t.description && !compact && !selection && (
                <p className="task-description">{t.description}</p>
              )}
              {activity && (
                <p className="task-day-meta">
                  <span>Created {dateLabel(localDate(t.created_at))}</span>
                  <span>{activity.days[t.id]}</span>
                  {localDate(t.created_at) < activity.date &&
                    !["completed", "cancelled"].includes(t.status) && (
                      <span className="task-carried-label">
                        Carried forward
                      </span>
                    )}
                </p>
              )}
              {t.blocker && t.status === "blocked" && (
                <p className="blocker-text">{t.blocker}</p>
              )}
              {!selection && (
                <div className="task-card-footer">
                  <Avatar
                    name={
                      people.data?.find((p) => p.id === t.assignee_id)?.name ||
                      "Unassigned"
                    }
                    src={
                      people.data?.find((p) => p.id === t.assignee_id)
                        ?.avatar_url || undefined
                    }
                  />
                  <span className="task-owner">
                    {people.data?.find((p) => p.id === t.assignee_id)?.name ||
                      "Unassigned"}
                  </span>
                  <Badge value={t.priority} />
                  {t.target_date && (
                    <span className="task-due">
                      Due {dateLabel(t.target_date)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {selection && (
              <>
                <div className="register-owner">
                  <Avatar
                    name={
                      people.data?.find((p) => p.id === t.assignee_id)?.name ||
                      "Unassigned"
                    }
                    src={
                      people.data?.find((p) => p.id === t.assignee_id)
                        ?.avatar_url || undefined
                    }
                  />
                  <span>
                    {people.data?.find((p) => p.id === t.assignee_id)?.name ||
                      "Unassigned"}
                  </span>
                </div>
                <div className="register-priority">
                  <Badge value={t.priority} />
                </div>
                <div className="register-due">
                  {t.target_date ? dateLabel(t.target_date) : "No due date"}
                </div>
              </>
            )}
            <div className="task-actions">
              {selection && (
                <TaskStatusPicker
                  taskNumber={t.task_number}
                  value={t.status}
                  developer={profile?.role === "developer"}
                  disabled={disabled || mutation.isPending}
                  onChange={(status) => {
                    if (status === "blocked") {
                      setEditing({ ...t, status: "blocked" });
                      return;
                    }
                    mutation.mutate({
                      action: "task",
                      payload: {
                        id: t.id,
                        status,
                        expected_updated_at: t.updated_at,
                      },
                    });
                  }}
                />
              )}
              {profile?.role !== "developer" && (
                <Button
                  variant="ghost"
                  size={compact ? "icon" : "sm"}
                  aria-label={`Edit ${t.title}`}
                  onClick={() => setEditing(t)}
                >
                  {compact ? <ArrowUpRight size={18} /> : "Update"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Discuss ${t.title}`}
                onClick={() => setDetail(t)}
              >
                <MessageSquare size={16} />
              </Button>
            </div>
          </TaskRow>
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
  const businessDate = useBusinessDate();
  const [moveNotice, setMoveNotice] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    status: Task["status"];
  } | null>(null);
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
  const [limit, setLimit] = useState(10);
  const [searchDetail, setSearchDetail] = useState<Task>();
  const searchQuery = useSearchQuery(search);
  const filters: Filter[] = [
    ...(mine
      ? [
          {
            column: "assignee_id",
            op: "assigned" as const,
            value: profile!.id,
          },
        ]
      : []),
    ...(mine && search
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
  const searchResults = useTaskSearch(searchQuery, filters, page, limit, !mine);
  const pagedTasks = { ...searchResults, data: searchResults.data?.items };
  const ownedTasks = useAllRows("tasks", filters, mine),
    tasks = mine ? ownedTasks : pagedTasks,
    teams = useAllRows("teams"),
    projects = useAllRows("projects"),
    modules = useAllRows("modules"),
    people = useAllRows("profiles"),
    mutation = useCommand();
  const filtered = (tasks.data || []).filter((task) => {
    if (!mine) return true;
    if (task.start_date && task.start_date > businessDate) return false;
    if (task.status === "cancelled") return false;
    return (
      task.status !== "completed" ||
      (!!task.completed_at && localDate(task.completed_at) === businessDate)
    );
  });
  const history = useAllRows(
    "task_status_history",
    [{ column: "task_id", op: "in", value: filtered.map((task) => task.id) }],
    mine && filtered.length > 0,
  );
  const calendarSettings = useAllRows("working_calendar_settings", [], mine);
  const holidays = useAllRows("holidays", [], mine);
  const activity = mine
    ? {
        date: businessDate,
        days: Object.fromEntries(
          filtered.map((task) => [
            task.id,
            history.isPending ||
            calendarSettings.isPending ||
            holidays.isPending
              ? "Loading day tracking…"
              : history.error || calendarSettings.error || holidays.error
                ? "Day tracking unavailable"
                : progressDaysLabel(
                    daysInProgress(
                      task,
                      history.data || [],
                      businessDate,
                      calendarSettings.data?.[0]?.working_days,
                      holidays.data?.map((h) => h.holiday_date),
                    ),
                  ),
          ]),
        ),
      }
    : undefined;
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
        title={mine ? "Today’s tasks" : "Task register"}
        description={
          mine
            ? `${dateLabel(businessDate)} · Unfinished work carries forward automatically. Move tasks as you make progress.`
            : "See what each developer and team is working on."
        }
        actions={
          mine ? (
            <Button onClick={() => setCreate(true)}>
              <Plus size={17} />
              {mine ? "Add my task" : "Add task"}
            </Button>
          ) : undefined
        }
      />
      {mine && (
        <DeveloperCompletionHeatmap
          developerId={profile!.id}
          name={profile!.name}
        />
      )}
      <Card className={`panel filter-panel ${mine ? "board-toolbar" : ""}`}>
        <div className="search-field">
          <Search size={17} />
          <Input
            aria-label="Search tasks"
            maxLength={200}
            placeholder="Search by ID, title or description…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              setSelected([]);
            }}
          />
        </div>
        {!mine && (
          <TaskSearchCommand
            filters={filters}
            onApply={(query) => {
              setSearch(query);
              setPage(0);
              setSelected([]);
            }}
            onTask={setSearchDetail}
          />
        )}
        {mine && (
          <p className="muted">
            {filtered.length} tasks on this page · Drag by the grip to move a
            task, or use its status menu.
          </p>
        )}
        {!mine && (
          <div className="filters">
            <NativeSelect
              aria-label="Filter status"
              value={status}
              onChange={change(setStatus)}
            >
              <NativeSelectOption value="">All statuses</NativeSelectOption>
              {statuses.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {label(s)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Filter team"
              value={team}
              onChange={change(setTeam)}
            >
              <NativeSelectOption value="">All teams</NativeSelectOption>
              {teams.data?.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Filter project"
              value={project}
              onChange={change(setProject)}
            >
              <NativeSelectOption value="">All projects</NativeSelectOption>
              {projects.data?.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Filter module"
              value={module}
              onChange={change(setModule)}
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
            {!mine && (
              <NativeSelect
                aria-label="Filter developer"
                value={assignee}
                onChange={change(setAssignee)}
              >
                <NativeSelectOption value="">All developers</NativeSelectOption>
                {people.data?.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            <NativeSelect
              aria-label="Filter priority"
              value={priority}
              onChange={change(setPriority)}
            >
              <NativeSelectOption value="">All priorities</NativeSelectOption>
              {["low", "medium", "high", "urgent"].map((p) => (
                <NativeSelectOption key={p}>{p}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </Card>
      {!mine && selected.length > 0 && (
        <div
          className="bulk-toolbar"
          role="region"
          aria-label="Selected task actions"
        >
          <span role="status">{selected.length} selected</span>
          <Button variant="ghost" onClick={() => setSelected([])}>
            Clear selection
          </Button>
          <NativeSelect
            aria-label="Bulk status"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            {statuses
              .filter((s) => s !== "blocked")
              .map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {label(s)}
                </NativeSelectOption>
              ))}
          </NativeSelect>
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
          <NativeSelect
            aria-label="Bulk assignee"
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
          >
            <NativeSelectOption value="">Unassigned</NativeSelectOption>
            {people.data
              ?.filter((p) => p.status === "active")
              .map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
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
      {mine ? (
        tasks.isPending ? (
          <Loading />
        ) : tasks.error ? (
          <ErrorState error={tasks.error} retry={() => void tasks.refetch()} />
        ) : (
          <DragDropProvider
            onDragEnd={(event) => {
              if (event.canceled || mutation.isPending) return;
              const task = filtered.find(
                (t) => `SYNC-${t.task_number}` === event.operation.source?.id,
              );
              const stage = taskStages.find(
                (s) => s.status === event.operation.target?.id,
              );
              if (!task || !stage || stage.states.includes(task.status)) return;
              setPendingMove({ id: task.id, status: stage.status });
              setMoveNotice("");
              mutation.mutate(
                {
                  action: "task",
                  payload: {
                    id: task.id,
                    status: stage.status,
                    expected_updated_at: task.updated_at,
                  },
                },
                {
                  onSuccess: () =>
                    setMoveNotice(
                      `SYNC-${task.task_number} moved to ${stage.title}.`,
                    ),
                  onError: () => setMoveNotice(""),
                  onSettled: () => setPendingMove(null),
                },
              );
            }}
          >
            <div className="task-board">
              {taskStages.map((group) => {
                const items = filtered
                  .map((task) =>
                    task.id === pendingMove?.id
                      ? { ...task, status: pendingMove.status }
                      : task,
                  )
                  .filter((task) => group.states.includes(task.status));
                return (
                  <TaskColumn
                    stage={group}
                    count={items.length}
                    disabled={mutation.isPending}
                    key={group.status}
                  >
                    {items.length ? (
                      <TaskList
                        tasks={items}
                        disabled={mutation.isPending}
                        draggable
                        activity={activity}
                      />
                    ) : null}
                  </TaskColumn>
                );
              })}
            </div>
            <DragOverlay
              className="task-board task-drag-overlay"
              dropAnimation={async ({ source, feedbackElement }) => {
                if (matchMedia("(prefers-reduced-motion: reduce)").matches)
                  return;
                const destination = document.querySelector(
                  `[data-task-key="${source.id}"]`,
                );
                if (!destination) return;
                const from = feedbackElement.getBoundingClientRect();
                const to = destination.getBoundingClientRect();
                const translate = getComputedStyle(feedbackElement).translate;
                const [x = 0, y = 0] =
                  translate === "none"
                    ? []
                    : translate.split(/\s+/).map(parseFloat);
                feedbackElement.setAttribute("data-dnd-dropping", "");
                const animation = feedbackElement.animate(
                  [
                    { translate: `${x}px ${y}px` },
                    {
                      translate: `${x + to.x - from.x}px ${y + to.y - from.y}px`,
                    },
                  ],
                  {
                    duration: 180,
                    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                    fill: "forwards",
                  },
                );
                try {
                  await animation.finished;
                } finally {
                  animation.cancel();
                  feedbackElement.removeAttribute("data-dnd-dropping");
                }
              }}
            >
              {(source) => (
                <div aria-hidden="true" inert>
                  <Card className="task-row">
                    <span className="task-drag-handle">
                      <GripVertical size={18} />
                    </span>
                    {source.data.preview as ReactNode}
                  </Card>
                </div>
              )}
            </DragOverlay>
          </DragDropProvider>
        )
      ) : (
        <Card className="panel">
          <div className="panel-heading">
            <h2>{mine ? "Assigned to you" : "All work"}</h2>
            <span className="muted">{filtered.length} on this page</span>
          </div>
          {tasks.isPending ? (
            <Loading />
          ) : tasks.error ? (
            <ErrorState
              error={tasks.error}
              retry={() => void tasks.refetch()}
            />
          ) : filtered.length ? (
            <>
              <div className="register-heading">
                <Checkbox
                  aria-label="Select all tasks on this page"
                  checked={
                    filtered.every((t) => selected.includes(t.id))
                      ? true
                      : selected.length
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked === true ? filtered.map((t) => t.id) : [],
                    )
                  }
                />
                <span>Task</span>
                <span className="register-owner-heading">Developer</span>
                <span className="register-priority-heading">Priority</span>
                <span className="register-due-heading">Due date</span>
                <span className="register-actions-heading">
                  Status & actions
                </span>
              </div>
              <TaskList
                tasks={filtered}
                selection={{ ids: selected, setIds: setSelected }}
              />
            </>
          ) : (
            <Empty title="No tasks match">
              Add work or adjust your filters.
            </Empty>
          )}
        </Card>
      )}
      {mine && (
        <p className="board-feedback" role="status">
          {mutation.isPending ? "Moving task…" : moveNotice}
        </p>
      )}
      {!mine && !tasks.error && (
        <nav
          className="task-register-pagination"
          aria-label="Task register pagination"
        >
          <Field label="Rows per page">
            <NativeSelect
              value={String(limit)}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(0);
                setSelected([]);
              }}
            >
              {[10, 25, 50, 100].map((size) => (
                <NativeSelectOption key={size} value={size}>
                  {size}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <p className="muted">
            {searchResults.data?.total
              ? `${searchResults.data.page * limit + 1}–${Math.min((searchResults.data.page + 1) * limit, searchResults.data.total)} of ${searchResults.data.total} tasks`
              : "0 tasks"}
          </p>
          <div className="toolbar">
            <Button
              variant="secondary"
              disabled={tasks.isPending || !searchResults.data?.page}
              onClick={() => {
                setPage((searchResults.data?.page || 0) - 1);
                setSelected([]);
              }}
            >
              Previous
            </Button>
            <span>
              Page {(searchResults.data?.page || 0) + 1} of{" "}
              {Math.max(1, Math.ceil((searchResults.data?.total || 0) / limit))}
            </span>
            <Button
              variant="secondary"
              disabled={
                tasks.isPending ||
                ((searchResults.data?.page || 0) + 1) * limit >=
                  (searchResults.data?.total || 0)
              }
              onClick={() => {
                setPage((searchResults.data?.page || 0) + 1);
                setSelected([]);
              }}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
      {searchDetail && (
        <TaskDetail
          task={searchDetail}
          onClose={() => setSearchDetail(undefined)}
        />
      )}
      {create && (
        <TaskEditor open onClose={() => setCreate(false)} defaultTeam={team} />
      )}
    </>
  );
}
