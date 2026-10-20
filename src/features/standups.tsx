import { useState } from "react";
import { Plus, Check, Sun, Moon } from "lucide-react";
import { useAllRows, useCommand } from "../lib/api";
import {
  attendanceFor,
  carryForward,
  dateLabel,
  previousWorkday,
  today,
  localDate,
} from "../lib/business";
import type { Profile, WorkLog } from "../types/database";
import { TaskEditor, TaskList } from "./tasks";
import { UpdateDialog } from "./updates";
import { Button } from "../components/ui/button";
import {
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  Metrics,
  PageHeader,
} from "../components/shared";
import { Dialog } from "../components/ui/dialog";
export function ReviewDialog({
  log,
  person,
  onClose,
}: {
  log: WorkLog;
  person?: Profile;
  onClose: () => void;
}) {
  const [note, setNote] = useState(""),
    mutation = useCommand();
  const updates = useAllRows("daily_task_updates", [
    { column: "work_log_id", value: log.id },
  ]);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`Review · ${person?.name || "Team member"}`}
    >
      <div className="detail-stack">
        <div className="toolbar">
          <Badge value={log.status} />
          <span>
            {log.hours} hours · {dateLabel(log.work_date)}
          </span>
        </div>
        {[
          ["Completed", log.completed_work],
          ["Remaining", log.remaining_work],
          ["Blockers", log.blockers],
          ["Additional work", log.unplanned_work],
          ["Notes", log.notes],
        ].map(([name, value]) => (
          <div key={name}>
            <h3>{name}</h3>
            <p className="preserve-lines">{value || "None recorded"}</p>
          </div>
        ))}
        {updates.error && <ErrorState error={updates.error} />}
        <h3>Task snapshots</h3>
        {updates.data?.map((u) => (
          <div className="list-row" key={u.id}>
            <span>{u.title}</span>
            <Badge value={u.status} />
          </div>
        ))}
        <small className="muted">
          Recorded by{" "}
          {log.recorded_by === log.developer_id
            ? "the developer"
            : "an administrator"}{" "}
          · Reviewer attribution is saved automatically.
        </small>
        <Field label="Decision note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required when requesting a revision"
          />
        </Field>
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={mutation.isPending || !note.trim()}
            onClick={() =>
              mutation.mutate(
                {
                  action: "review",
                  payload: {
                    id: log.id,
                    status: "revision_requested",
                    review_note: note,
                  },
                },
                { onSuccess: onClose },
              )
            }
          >
            {log.status === "approved"
              ? "Reopen for revision"
              : "Request revision"}
          </Button>
          {log.status === "submitted" && (
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate(
                  {
                    action: "review",
                    payload: {
                      id: log.id,
                      status: "approved",
                      review_note: note,
                    },
                  },
                  { onSuccess: onClose },
                )
              }
            >
              <Check size={16} />
              Approve update
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
export function StandupPage({ evening = false }: { evening?: boolean }) {
  const [date, setDate] = useState(today()),
    [team, setTeam] = useState(""),
    [selected, setSelected] = useState(""),
    [adding, setAdding] = useState(false),
    [capture, setCapture] = useState(false),
    [review, setReview] = useState<WorkLog>(),
    [notes, setNotes] = useState<string | null>(null),
    [saved, setSaved] = useState("");
  const [assignExisting, setAssignExisting] = useState(false),
    [existingId, setExistingId] = useState("");
  const teams = useAllRows("teams"),
    people = useAllRows("profiles"),
    memberships = useAllRows("team_memberships"),
    calendar = useAllRows("working_calendar_settings"),
    holidays = useAllRows("holidays"),
    contributors = useAllRows("task_assignees");
  const teamId = team || teams.data?.find((t) => !t.archived)?.id || "";
  const tasks = useAllRows(
      "tasks",
      [{ column: "team_id", value: teamId }],
      !!teamId,
    ),
    logs = useAllRows(
      "daily_work_logs",
      [
        { column: "work_date", value: date },
        { column: "team_id", value: teamId },
      ],
      !!teamId,
    ),
    leaves = useAllRows(
      "leave_requests",
      [
        { column: "team_id", value: teamId },
        { column: "starts_on", op: "lte", value: date },
        { column: "ends_on", op: "gte", value: date },
      ],
      !!teamId,
    ),
    sessions = useAllRows(
      "standup_sessions",
      [
        { column: "team_id", value: teamId },
        { column: "meeting_date", value: date },
      ],
      !!teamId,
    ),
    mutation = useCommand();
  const roster =
    people.data?.filter(
      (p) =>
        p.status === "active" &&
        memberships.data?.some(
          (m) =>
            m.developer_id === p.id &&
            m.team_id === teamId &&
            m.starts_on <= date &&
            (!m.ends_on || m.ends_on > date),
        ),
    ) || [];
  const person = roster.find((p) => p.id === selected) || roster[0];
  const personal = (tasks.data || []).filter(
      (t) =>
        t.assignee_id === person?.id ||
        contributors.data?.some(
          (c) => c.task_id === t.id && c.developer_id === person?.id,
        ),
    ),
    log = logs.data?.find((l) => l.developer_id === person?.id),
    period = evening ? "evening" : "morning",
    session = sessions.data?.find((s) => s.period === period);
  const days = calendar.data?.[0]?.working_days,
    holidayDates = holidays.data?.map((h) => h.holiday_date);
  const attendance = (id: string) =>
    attendanceFor(
      date,
      leaves.data?.filter((l) => l.developer_id === id) || [],
      days,
      holidayDates,
    );
  let previous = "";
  try {
    previous = previousWorkday(date, days, holidayDates);
  } catch {
    /* An empty calendar is reported by Settings validation. */
  }
  const previousLogs = useAllRows(
    "daily_work_logs",
    [
      { column: "team_id", value: teamId },
      { column: "work_date", value: previous },
    ],
    !!teamId && !!previous,
  );
  const morning = sessions.data?.find((s) => s.period === "morning");
  const morningAssignments = useAllRows(
    "standup_assignments",
    [{ column: "session_id", value: morning?.id || "" }],
    !!morning,
  );
  const morningTasks = (tasks.data || []).filter((t) =>
    morningAssignments.data?.some(
      (a) => a.task_id === t.id && a.developer_id === person?.id,
    ),
  );
  const previousLog = previousLogs.data?.find(
    (l) => l.developer_id === person?.id,
  );
  const done = personal.filter(
      (t) =>
        t.status === "completed" &&
        !!t.completed_at &&
        localDate(t.completed_at) === previous,
    ),
    carry = carryForward(personal, date),
    blocked = personal.filter((t) => t.status === "blocked"),
    fresh = personal.filter(
      (t) =>
        localDate(t.created_at) === date &&
        !["completed", "cancelled"].includes(t.status),
    );
  const error =
    teams.error ||
    people.error ||
    memberships.error ||
    calendar.error ||
    holidays.error ||
    tasks.error ||
    logs.error ||
    leaves.error ||
    sessions.error ||
    contributors.error ||
    previousLogs.error ||
    morningAssignments.error;
  const confirm = (state: "draft" | "confirmed") =>
    mutation.mutate(
      {
        action: "plan",
        payload: {
          team_id: teamId,
          meeting_date: date,
          period,
          state,
          notes: notes ?? session?.notes ?? "",
          expected_updated_at: session?.updated_at,
          assignments: (tasks.data || [])
            .filter(
              (t) =>
                t.assignee_id &&
                !["completed", "cancelled", "backlog"].includes(t.status) &&
                roster.some((p) => p.id === t.assignee_id),
            )
            .flatMap((t) => [
              { task_id: t.id, developer_id: t.assignee_id },
              ...(contributors.data || [])
                .filter(
                  (c) =>
                    c.task_id === t.id &&
                    c.developer_id !== t.assignee_id &&
                    roster.some((p) => p.id === c.developer_id),
                )
                .map((c) => ({ task_id: t.id, developer_id: c.developer_id })),
            ]),
        },
      },
      {
        onSuccess: () =>
          setSaved(
            state === "confirmed"
              ? "Meeting plan confirmed."
              : "Meeting draft saved.",
          ),
      },
    );
  return (
    <>
      <PageHeader
        eyebrow={evening ? "Close the loop" : "Set the direction"}
        title={evening ? "Evening standup" : "Morning standup"}
        description={
          evening
            ? "Review the day. Keep the next step clear."
            : "Yesterday’s context. Today’s shared plan."
        }
        actions={
          <>
            <input
              aria-label="Meeting date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setNotes(null);
                setSaved("");
              }}
            />
            <select
              aria-label="Meeting team"
              value={teamId}
              onChange={(e) => {
                setTeam(e.target.value);
                setSelected("");
                setNotes(null);
                setSaved("");
              }}
            >
              {teams.data
                ?.filter((t) => !t.archived)
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} />
      ) : teams.isPending ||
        people.isPending ||
        memberships.isPending ||
        calendar.isPending ||
        holidays.isPending ||
        contributors.isPending ||
        (!!teamId &&
          (tasks.isPending ||
            logs.isPending ||
            leaves.isPending ||
            sessions.isPending)) ? (
        <Loading />
      ) : !teamId ? (
        <Empty title="Create your first team">
          Add a team and its members before running a standup.
        </Empty>
      ) : (
        <>
          <Metrics
            items={
              evening
                ? [
                    { label: "Team members", value: roster.length },
                    {
                      label: "Submitted updates",
                      value:
                        logs.data?.filter((l) =>
                          ["submitted", "approved"].includes(l.status),
                        ).length || 0,
                    },
                    {
                      label: "On full-day leave",
                      value: roster.filter(
                        (p) => attendance(p.id).attendance === "on_leave",
                      ).length,
                    },
                    {
                      label: "Completed tasks",
                      value:
                        tasks.data?.filter(
                          (t) =>
                            t.status === "completed" &&
                            !!t.completed_at &&
                            localDate(t.completed_at) === date,
                        ).length || 0,
                    },
                  ]
                : [
                    {
                      label: "Available members",
                      value: roster.filter((p) => attendance(p.id).hours > 0)
                        .length,
                    },
                    {
                      label: "Carry-forward work",
                      value: carryForward(tasks.data || [], date).length,
                    },
                    {
                      label: "New today",
                      value:
                        tasks.data?.filter(
                          (t) => localDate(t.created_at) === date,
                        ).length || 0,
                    },
                    {
                      label: "Blocked tasks",
                      value:
                        tasks.data?.filter((t) => t.status === "blocked")
                          .length || 0,
                    },
                  ]
            }
          />
          <div className="meeting-grid">
            <aside className="panel roster">
              <div className="panel-heading">
                <h2>Team members</h2>
                <span className="muted">{roster.length}</span>
              </div>
              {roster.length ? (
                roster.map((p) => {
                  const daily = logs.data?.find((l) => l.developer_id === p.id),
                    available = attendance(p.id);
                  return (
                    <button
                      key={p.id}
                      className={`roster-person ${p.id === person?.id ? "selected" : ""}`}
                      onClick={() => setSelected(p.id)}
                    >
                      <Avatar name={p.name} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {available.attendance === "on_leave"
                            ? "On leave"
                            : evening
                              ? daily?.status.replaceAll("_", " ") ||
                                "Update pending"
                              : available.attendance.replaceAll("_", " ")}
                        </small>
                        <span className="workload">
                          <span
                            style={{
                              width: `${Math.min(100, (tasks.data?.filter((t) => t.assignee_id === p.id && !["completed", "cancelled"].includes(t.status)).length || 0) * 20)}%`,
                            }}
                          />
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <Empty title="No members yet" />
              )}
            </aside>
            <section className="panel meeting-detail">
              {tasks.isPending || logs.isPending || leaves.isPending ? (
                <Loading />
              ) : person ? (
                <>
                  <div className="meeting-person">
                    <div className="toolbar">
                      <Avatar name={person.name} />
                      <div>
                        <h2>{person.name}</h2>
                        <p className="muted">
                          {teams.data?.find((t) => t.id === teamId)?.name} ·{" "}
                          {attendance(person.id).hours}h expected
                        </p>
                      </div>
                    </div>
                    <div className="toolbar">
                      <Badge value={attendance(person.id).attendance} />
                      {evening ? (
                        <Button
                          onClick={() => setCapture(true)}
                          variant="secondary"
                        >
                          {log ? "View / edit update" : "Record update"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setExistingId("");
                              setAssignExisting(true);
                            }}
                          >
                            Assign existing
                          </Button>
                          <Button onClick={() => setAdding(true)}>
                            <Plus size={16} />
                            Assign task
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {evening ? (
                    <>
                      <div className="section-heading">
                        <h3>Day’s progress</h3>
                        {log && <Badge value={log.status} />}
                      </div>
                      {log ? (
                        <div className="work-summary">
                          <p>
                            <strong>Completed</strong>
                            {log.completed_work || "No completed work recorded"}
                          </p>
                          <p>
                            <strong>Remaining</strong>
                            {log.remaining_work || "No remaining work recorded"}
                          </p>
                          <p>
                            <strong>Blockers</strong>
                            {log.blockers || "None recorded"}
                          </p>
                          <div className="toolbar">
                            <strong>{log.hours} hours reported</strong>
                            {["submitted", "approved"].includes(log.status) && (
                              <Button
                                variant="secondary"
                                onClick={() => setReview(log)}
                              >
                                Review update
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Empty
                          title={
                            attendance(person.id).attendance === "on_leave"
                              ? "On approved leave"
                              : "No update submitted"
                          }
                        >
                          {attendance(person.id).attendance === "on_leave"
                            ? "No daily update is expected."
                            : "Capture the update here or ask the developer to submit."}
                        </Empty>
                      )}
                      <div className="section-heading">
                        <h3>Morning assignments</h3>
                      </div>
                      {morningTasks.length ? (
                        <TaskList tasks={morningTasks} compact />
                      ) : (
                        <p className="group-empty">
                          {morning
                            ? "No morning assignments for this member."
                            : "No morning plan recorded for this date."}
                        </p>
                      )}
                      <div className="section-heading">
                        <h3>Current work</h3>
                      </div>
                      {personal.length ? (
                        <TaskList tasks={personal} compact />
                      ) : (
                        <Empty title="No assigned tasks" />
                      )}
                    </>
                  ) : (
                    <>
                      {previousLog && (
                        <div className="padded">
                          <h3>Previous working-day update</h3>
                          <p className="muted preserve-lines">
                            {previousLog.completed_work ||
                              "No completed work notes."}
                          </p>
                          {previousLog.remaining_work && (
                            <p className="muted">
                              Remaining: {previousLog.remaining_work}
                            </p>
                          )}
                          {previousLog.blockers && (
                            <p className="blocker-text">
                              {previousLog.blockers}
                            </p>
                          )}
                        </div>
                      )}
                      {[
                        {
                          name: "Completed last working day",
                          items: done,
                          caption: previous
                            ? dateLabel(previous)
                            : "No working day configured",
                        },
                        {
                          name: "Carry-forward work",
                          items: carry.filter((t) => t.status !== "blocked"),
                          caption: "Same task IDs, current progress",
                        },
                        {
                          name: "Blocked work",
                          items: blocked,
                          caption: "Discuss what needs to move",
                        },
                        {
                          name: "New assignments",
                          items: fresh,
                          caption: dateLabel(date),
                        },
                      ].map((group) => (
                        <div className="task-group" key={group.name}>
                          <div className="section-heading">
                            <h3>
                              {group.name}
                              <span className="count">
                                {group.items.length}
                              </span>
                            </h3>
                            <small className="muted">{group.caption}</small>
                          </div>
                          {group.items.length ? (
                            <TaskList tasks={group.items} compact />
                          ) : (
                            <p className="group-empty">
                              {group.name === "Blocked work"
                                ? "No blockers recorded."
                                : "No tasks in this group."}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <Empty title="Select a team member" />
              )}
            </section>
          </div>
          <section className="panel padded meeting-notes">
            <div className="panel-heading">
              <div className="toolbar">
                {evening ? <Moon size={19} /> : <Sun size={19} />}
                <h2>Meeting notes & confirmation</h2>
              </div>
              <Badge value={session?.state || "draft"} />
            </div>
            <Field label="Notes">
              <textarea
                value={notes ?? session?.notes ?? ""}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Decisions, priorities, and follow-ups for this meeting"
                rows={3}
              />
            </Field>
            <div className="dialog-actions">
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => confirm("draft")}
              >
                Save draft
              </Button>
              <Button
                disabled={mutation.isPending || !roster.length}
                onClick={() => confirm("confirmed")}
              >
                <Check size={16} />
                Confirm {evening ? "meeting" : "today’s plan"}
              </Button>
            </div>
            {saved && (
              <p className="success" role="status">
                {saved}
              </p>
            )}
            {mutation.error && <ErrorState error={mutation.error} />}
          </section>
        </>
      )}
      <Dialog
        open={assignExisting}
        onOpenChange={setAssignExisting}
        title={`Assign existing work to ${person?.name || "team member"}`}
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const task = tasks.data?.find((t) => t.id === existingId);
            if (task)
              mutation.mutate(
                {
                  action: "task",
                  payload: {
                    id: task.id,
                    assignee_id: person?.id,
                    status: task.status === "backlog" ? "planned" : task.status,
                    expected_updated_at: task.updated_at,
                  },
                },
                { onSuccess: () => setAssignExisting(false) },
              );
          }}
        >
          <Field label="Existing task">
            <select
              required
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
            >
              <option value="">Select work</option>
              {tasks.data
                ?.filter((t) => !["completed", "cancelled"].includes(t.status))
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    SYNC-{t.task_number} · {t.title}
                  </option>
                ))}
            </select>
          </Field>
          <p className="muted">
            This changes the primary assignee explicitly. Leave never reassigns
            work automatically.
          </p>
          {mutation.error && <ErrorState error={mutation.error} />}
          <Button disabled={mutation.isPending}>Assign task</Button>
        </form>
      </Dialog>
      {adding && (
        <TaskEditor
          open
          defaultTeam={teamId}
          defaultAssignee={person?.id}
          onClose={() => setAdding(false)}
        />
      )}
      {capture && person && (
        <UpdateDialog
          person={person}
          date={date}
          log={log}
          onClose={() => setCapture(false)}
        />
      )}
      {review && (
        <ReviewDialog
          log={review}
          person={person}
          onClose={() => setReview(undefined)}
        />
      )}
    </>
  );
}
