import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Link, useParams } from "react-router-dom";
import { Send, Save } from "lucide-react";
import { useAuth } from "../app/auth";
import { useAllRows, useCommand, useRows } from "../lib/api";
import { attendanceFor, dateLabel, today, workSchema } from "../lib/business";
import type { Profile, WorkLog } from "../types/database";
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
export function WorkForm({
  person,
  date,
  log,
  onDone,
}: {
  person: Profile;
  date: string;
  log?: WorkLog;
  onDone?: () => void;
}) {
  const leaves = useAllRows("leave_requests", [
      { column: "developer_id", value: person.id },
      { column: "status", value: "approved" },
      { column: "starts_on", op: "lte", value: date },
      { column: "ends_on", op: "gte", value: date },
    ]),
    calendar = useRows("working_calendar_settings"),
    holidays = useAllRows("holidays"),
    tasks = useAllRows("tasks", [
      { column: "assignee_id", op: "assigned", value: person.id },
    ]),
    snapshots = useAllRows(
      "daily_task_updates",
      [{ column: "work_log_id", value: log?.id || "" }],
      !!log,
    );
  const mutation = useCommand();
  const defaults = attendanceFor(
    date,
    leaves.data || [],
    calendar.data?.[0]?.working_days,
    holidays.data?.map((h) => h.holiday_date),
  );
  const [saved, setSaved] = useState("");
  const [chosen, setRelated] = useState<string[] | null>(null);
  const related = chosen ?? snapshots.data?.map((s) => s.task_id) ?? [];
  const form = useForm<z.infer<typeof workSchema>>({
    resolver: zodResolver(workSchema),
    values: {
      work_date: date,
      hours: Number(log?.hours ?? defaults.hours),
      attendance: log?.attendance ?? defaults.attendance,
      completed_work: log?.completed_work || "",
      remaining_work: log?.remaining_work || "",
      blockers: log?.blockers || "",
      unplanned_work: log?.unplanned_work || "",
      notes: log?.notes || "",
    },
  });
  const locked = log?.status === "approved" || log?.status === "submitted";
  async function save(status: "draft" | "submitted") {
    setSaved("");
    await form.handleSubmit(async (values) => {
      await mutation
        .mutateAsync({
          action: "work_log",
          payload: {
            ...values,
            developer_id: person.id,
            status,
            expected_updated_at: log?.updated_at,
            task_updates: related.map((task_id) => ({ task_id })),
          },
        })
        .then(() => {
          setSaved(
            status === "draft"
              ? "Draft saved."
              : "Update submitted for review.",
          );
          onDone?.();
        })
        .catch(() => {});
    })();
  }
  if (
    leaves.isPending ||
    calendar.isPending ||
    holidays.isPending ||
    tasks.isPending ||
    (!!log && snapshots.isPending)
  )
    return <Loading />;
  const error =
    leaves.error ||
    calendar.error ||
    holidays.error ||
    tasks.error ||
    snapshots.error;
  if (error) return <ErrorState error={error} />;
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void save("submitted");
      }}
    >
      <div className="notice">
        Hours are recorded once for your day, across all tasks. Expected:{" "}
        {defaults.hours}h · {defaults.attendance.replaceAll("_", " ")}.
      </div>
      {log?.review_note && (
        <div className="notice">Reviewer: {log.review_note}</div>
      )}
      {locked && (
        <div className="notice">
          This {log.status} update is locked. An administrator can return it for
          revision.
        </div>
      )}
      <fieldset disabled={locked || mutation.isPending}>
        <div className="form-row">
          <Field
            label="Hours worked"
            error={form.formState.errors.hours?.message}
          >
            <input
              type="number"
              min={0}
              max={24}
              step={0.25}
              {...form.register("hours", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Attendance">
            <select {...form.register("attendance")}>
              {[
                "working",
                "half_day",
                "on_leave",
                "absent",
                "holiday",
                "weekend",
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Work completed today">
          <textarea
            rows={3}
            {...form.register("completed_work")}
            placeholder="What did you finish?"
          />
        </Field>
        <Field label="Work remaining">
          <textarea
            rows={3}
            {...form.register("remaining_work")}
            placeholder="What will continue?"
          />
        </Field>
        <Field label="Blockers">
          <textarea rows={2} {...form.register("blockers")} />
        </Field>
        <Field label="Additional unplanned work">
          <textarea rows={2} {...form.register("unplanned_work")} />
        </Field>
        <Field label="Notes">
          <textarea rows={2} {...form.register("notes")} />
        </Field>
        <div className="field">
          <span>Related task snapshots</span>
          <p className="muted">
            Select the tasks covered by this update. Their current statuses are
            saved with your submission.
          </p>
          {tasks.data?.map((t) => (
            <label className="check-row" key={t.id}>
              <input
                type="checkbox"
                checked={related.includes(t.id)}
                onChange={(e) =>
                  setRelated(
                    e.target.checked
                      ? [...related, t.id]
                      : related.filter((id) => id !== t.id),
                  )
                }
              />
              SYNC-{t.task_number} · {t.title}
              <Badge value={t.status} />
            </label>
          ))}
          {snapshots.data
            ?.filter((s) => !tasks.data?.some((t) => t.id === s.task_id))
            .map((s) => (
              <label className="check-row" key={s.id}>
                <input
                  type="checkbox"
                  checked={related.includes(s.task_id)}
                  onChange={(e) =>
                    setRelated(
                      e.target.checked
                        ? [...related, s.task_id]
                        : related.filter((id) => id !== s.task_id),
                    )
                  }
                />
                {s.title} (saved snapshot)
                <Badge value={s.status} />
              </label>
            ))}
        </div>
      </fieldset>
      {mutation.error && <ErrorState error={mutation.error} />}
      {saved && (
        <p className="success" role="status">
          {saved}
        </p>
      )}
      {!locked && (
        <div className="dialog-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={mutation.isPending}
            onClick={() => void save("draft")}
          >
            <Save size={16} />
            Save draft
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            <Send size={16} />
            {mutation.isPending ? "Saving…" : "Submit update"}
          </Button>
        </div>
      )}
    </form>
  );
}
export function UpdateDialog({
  person,
  date,
  log,
  onClose,
}: {
  person: Profile;
  date: string;
  log?: WorkLog;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`${person.name} · ${dateLabel(date)}`}
      description="Record the day's work. Admin-entered updates retain the recorder's identity in the audit history."
    >
      <WorkForm person={person} date={date} log={log} onDone={onClose} />
    </Dialog>
  );
}
export function UpdatesPage({ history = false }: { history?: boolean }) {
  const { profile } = useAuth(),
    params = useParams();
  const [date, setDate] = useState(params.date || today()),
    [page, setPage] = useState(0);
  const logs = useRows(
    "daily_work_logs",
    [
      { column: "developer_id", value: profile!.id },
      ...(!history ? [{ column: "work_date", value: date }] : []),
    ],
    page,
  );
  return (
    <>
      <PageHeader
        title={history ? "My work history" : "My daily update"}
        description="A clear record of the day, with hours counted once."
        actions={
          !history && (
            <input
              aria-label="Update date"
              type="date"
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )
        }
      />
      {logs.isPending ? (
        <Loading />
      ) : logs.error ? (
        <ErrorState error={logs.error} />
      ) : history ? (
        <>
          <section className="panel">
            {logs.data.length ? (
              logs.data.map((l) => (
                <Link
                  className="list-row history-link"
                  key={l.id}
                  to={`/my-updates/${l.work_date}`}
                >
                  <div>
                    <strong>{dateLabel(l.work_date)}</strong>
                    <p className="muted">
                      {l.completed_work || l.remaining_work || "No work notes"}
                    </p>
                  </div>
                  <span>{l.hours}h</span>
                  <Badge value={l.status} />
                </Link>
              ))
            ) : (
              <Empty title="No updates yet" />
            )}
          </section>
          <Pager page={page} setPage={setPage} count={logs.data.length} />
        </>
      ) : (
        <section className="panel padded">
          <div className="panel-heading">
            <h2>{dateLabel(date)}</h2>
            {logs.data[0] && <Badge value={logs.data[0].status} />}
          </div>
          <WorkForm
            key={`${date}-${logs.data[0]?.updated_at || "new"}`}
            person={profile!}
            date={date}
            log={logs.data[0]}
          />
        </section>
      )}
    </>
  );
}
