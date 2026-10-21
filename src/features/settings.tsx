import { DeveloperCompletionHeatmap } from "../components/developer-completion-heatmap";
import { Controller } from "react-hook-form";
import { Checkbox } from "../components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/table";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useValidatedForm } from "../lib/use-validated-form";
import {
  profileSchema,
  calendarSchema,
  holidaySchema,
  nameSchema,
  integrationSchema,
} from "../lib/form-schemas";
import { useState } from "react";
import { useAuth } from "../app/auth";
import { useAllRows, useCommand, useRows, message } from "../lib/api";
import { client } from "../lib/supabase";
import { dateLabel, today } from "../lib/business";
import { Button } from "../components/ui/button";
import {
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Pager,
} from "../components/shared";
export function ProfilePage() {
  const { profile, avatarUrl } = useAuth(),
    [name, setName] = useState(profile!.name),
    [job, setJob] = useState(profile!.job_title),
    [saved, setSaved] = useState(false),
    mutation = useCommand();
  const form = useValidatedForm(profileSchema, { name, job });
  return (
    <>
      <PageHeader
        title="My profile"
        description="Your display name and reporting role."
      />
      <DeveloperCompletionHeatmap
        developerId={profile!.id}
        name={profile!.name}
      />
      <Card className="panel padded narrow">
        <div className="profile-identity">
          <Avatar name={profile!.name} src={avatarUrl} />
          <div>
            <strong>{profile!.name}</strong>
            <p className="muted">{profile!.email}</p>
          </div>
        </div>
        <form
          className="form-grid"
          noValidate
          onSubmit={form.handleSubmit((values) => {
            mutation.mutate(
              {
                action: "profile",
                payload: { name: values.name, job_title: values.job },
              },
              { onSuccess: () => setSaved(true) },
            );
          })}
        >
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input
              required
              maxLength={120}
              value={name}
              {...form.register("name", {
                onChange: (e) => setName(e.target.value),
              })}
            />
          </Field>
          <Field
            label="Job title (shown in work reports)"
            error={form.formState.errors.job?.message}
          >
            <Input
              required
              maxLength={120}
              value={job}
              {...form.register("job", {
                onChange: (e) => setJob(e.target.value),
              })}
            />
          </Field>
          <Field label="Work email">
            <Input disabled value={profile!.email} />
          </Field>
          <p className="muted">
            Access role: {profile!.role.replaceAll("_", " ")}. Only a Super
            Admin can change access.
          </p>
          {mutation.error && <ErrorState error={mutation.error} />}
          {saved && (
            <p className="success" role="status">
              Profile saved.
            </p>
          )}
          <Button disabled={mutation.isPending}>Save profile</Button>
        </form>
      </Card>
    </>
  );
}
export function SettingsPage() {
  const calendar = useAllRows("working_calendar_settings"),
    holidays = useAllRows("holidays"),
    types = useAllRows("leave_types"),
    mutation = useCommand();
  const [days, setDays] = useState<number[] | null>(null),
    [domains, setDomains] = useState<string | null>(null),
    [holiday, setHoliday] = useState(today()),
    [holidayName, setHolidayName] = useState(""),
    [type, setType] = useState(""),
    [saved, setSaved] = useState("");
  const current = calendar.data?.[0],
    working = days ?? current?.working_days ?? [1, 2, 3, 4, 5];
  const calendarForm = useValidatedForm(calendarSchema, {
    days: working,
    domains: domains ?? current?.allowed_domains.join(", ") ?? "",
  });
  const holidayForm = useValidatedForm(holidaySchema, {
    date: holiday,
    name: holidayName,
  });
  const typeForm = useValidatedForm(nameSchema, { name: type });
  return (
    <>
      <PageHeader
        title="Workspace settings"
        description="Working days, public holidays, and account eligibility."
      />
      {calendar.error && <ErrorState error={calendar.error} />}
      <div className="settings-grid">
        <Card className="panel padded">
          <h2>Working calendar</h2>
          <p className="muted">
            Dates use Asia/Colombo. Nonworking dates do not create
            missing-update alerts.
          </p>
          <form
            className="form-grid"
            noValidate
            onSubmit={calendarForm.handleSubmit(() => {
              mutation.mutate(
                {
                  action: "calendar",
                  payload: {
                    working_days: working,
                    allowed_domains: (
                      domains ??
                      current?.allowed_domains.join(",") ??
                      ""
                    )
                      .split(",")
                      .map((d) => d.trim().toLowerCase())
                      .filter(Boolean),
                  },
                },
                { onSuccess: () => setSaved("Calendar settings saved.") },
              );
            })}
          >
            <div className="day-options">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (name, i) => (
                  <Label
                    key={name}
                    className={
                      working.includes(i) ? "day-option checked" : "day-option"
                    }
                  >
                    <Checkbox
                      checked={working.includes(i)}
                      onCheckedChange={(checked) => {
                        const next =
                          checked === true
                            ? [...working, i]
                            : working.filter((d) => d !== i);
                        setDays(next);
                        calendarForm.setValue("days", next, {
                          shouldValidate: calendarForm.formState.isSubmitted,
                        });
                      }}
                      aria-invalid={!!calendarForm.formState.errors.days}
                      aria-describedby={
                        calendarForm.formState.errors.days
                          ? "working-days-error"
                          : undefined
                      }
                    />
                    {name}
                  </Label>
                ),
              )}
            </div>
            {calendarForm.formState.errors.days && (
              <p id="working-days-error" className="field-error" role="alert">
                {calendarForm.formState.errors.days.message}
              </p>
            )}
            <Field
              label="Allowed email domains (comma separated)"
              error={calendarForm.formState.errors.domains?.message}
            >
              <Input
                value={domains ?? current?.allowed_domains.join(", ") ?? ""}
                {...calendarForm.register("domains", {
                  onChange: (e) => setDomains(e.target.value),
                })}
                placeholder="Leave empty to allow any domain"
                pattern="[a-zA-Z0-9.,\- ]*"
              />
            </Field>
            <Button disabled={mutation.isPending}>Save calendar</Button>
          </form>
        </Card>
        <Card className="panel padded">
          <h2>Public holidays</h2>
          <form
            className="form-grid"
            noValidate
            onSubmit={holidayForm.handleSubmit((values) => {
              mutation.mutate(
                {
                  action: "holiday",
                  payload: { holiday_date: holiday, name: values.name },
                },
                {
                  onSuccess: () => {
                    setHolidayName("");
                    setSaved("Holiday saved.");
                  },
                },
              );
            })}
          >
            <div className="form-row">
              <Field
                label="Date"
                error={holidayForm.formState.errors.date?.message}
              >
                <Input
                  required
                  type="date"
                  value={holiday}
                  {...holidayForm.register("date", {
                    onChange: (e) => setHoliday(e.target.value),
                  })}
                />
              </Field>
              <Field
                label="Holiday name"
                error={holidayForm.formState.errors.name?.message}
              >
                <Input
                  required
                  maxLength={120}
                  value={holidayName}
                  {...holidayForm.register("name", {
                    onChange: (e) => setHolidayName(e.target.value),
                  })}
                />
              </Field>
            </div>
            <Button variant="secondary" disabled={mutation.isPending}>
              Add holiday
            </Button>
          </form>
          {holidays.error && <ErrorState error={holidays.error} />}
          {holidays.data?.map((h) => (
            <div className="list-row" key={h.id}>
              <span>
                {dateLabel(h.holiday_date)} · {h.name}
              </span>
              <Button
                variant="ghost"
                onClick={() =>
                  mutation.mutate({
                    action: "holiday",
                    payload: { id: h.id, remove: true },
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </Card>
        <Card className="panel padded">
          <h2>Leave types</h2>
          <form
            className="toolbar"
            noValidate
            onSubmit={typeForm.handleSubmit((values) => {
              mutation.mutate(
                { action: "leave_type", payload: { name: values.name } },
                { onSuccess: () => setType("") },
              );
            })}
          >
            <Field
              label="New leave type"
              error={typeForm.formState.errors.name?.message}
            >
              <Input
                id="new-type"
                value={type}
                maxLength={120}
                {...typeForm.register("name", {
                  onChange: (e) => setType(e.target.value),
                })}
                placeholder="New leave type"
              />
            </Field>
            <Button variant="secondary" disabled={mutation.isPending}>
              Add type
            </Button>
          </form>
          {types.data?.map((t) => (
            <div className="list-row" key={t.id}>
              <span>{t.name}</span>
              <Button
                variant="ghost"
                onClick={() =>
                  mutation.mutate({
                    action: "leave_type",
                    payload: { id: t.id, name: t.name, active: !t.active },
                  })
                }
              >
                {t.active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))}
        </Card>
      </div>
      {mutation.error && <ErrorState error={mutation.error} />}
      {saved && (
        <p className="success" role="status">
          {saved}
        </p>
      )}
    </>
  );
}
export function IntegrationsPage() {
  const settings = useAllRows("google_sheet_integrations"),
    jobs = useRows("sync_jobs"),
    mutation = useCommand();
  const [sheet, setSheet] = useState<string | null>(null),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  const config = settings.data?.[0];
  const integrationForm = useValidatedForm(integrationSchema, {
    sheet: sheet ?? config?.spreadsheet_id ?? "",
    enabled: enabled ?? config?.enabled ?? false,
  });
  async function sync() {
    setBusy(true);
    setError("");
    try {
      const { data, error } =
        await client().functions.invoke("google-sheets-sync");
      if (error) throw error;
      setFeedback(
        `Synchronization complete: ${data.records} approved daily records.`,
      );
      void jobs.refetch();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Supabase is the source of truth. Sheets is an optional reporting destination."
      />
      <Card className="panel padded narrow">
        <h2>Google Sheets</h2>
        <p className="muted">
          Configure service-account credentials as Edge Function secrets first.
          Share the spreadsheet with that account as an editor. SyncOra owns the
          five named reporting tabs.
        </p>
        <form
          className="form-grid"
          noValidate
          onSubmit={integrationForm.handleSubmit((values) => {
            mutation.mutate(
              {
                action: "integration",
                payload: {
                  enabled: values.enabled,
                  spreadsheet_id: values.sheet,
                },
              },
              { onSuccess: () => setFeedback("Integration settings saved.") },
            );
          })}
        >
          <Field
            label="Spreadsheet ID"
            error={integrationForm.formState.errors.sheet?.message}
          >
            <Input
              required={enabled ?? config?.enabled ?? false}
              value={sheet ?? config?.spreadsheet_id ?? ""}
              {...integrationForm.register("sheet", {
                onChange: (e) => setSheet(e.target.value),
              })}
              pattern="[a-zA-Z0-9_-]*"
            />
          </Field>
          <Label className="check-row">
            <Controller
              control={integrationForm.control}
              name="enabled"
              render={({ field }) => (
                <Checkbox
                  name={field.name}
                  ref={field.ref}
                  checked={field.value}
                  onBlur={field.onBlur}
                  onCheckedChange={(value) => {
                    field.onChange(value === true);
                    setEnabled(value === true);
                  }}
                />
              )}
            />
            Enable Google Sheets synchronization
          </Label>
          <div className="toolbar">
            <Button disabled={mutation.isPending}>Save configuration</Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !config?.enabled}
              onClick={() => void sync()}
            >
              {busy ? "Synchronizing…" : "Sync approved records / retry"}
            </Button>
          </div>
        </form>
        <div className="notice">
          Credentials stay on the server. Schedule instructions and required
          secrets are in docs/google-sheets-setup.md.
        </div>
        {settings.error && <ErrorState error={settings.error} />}
        {(error || mutation.error) && (
          <ErrorState error={mutation.error || new Error(error)} />
        )}
        {feedback && (
          <p className="success" role="status">
            {feedback}
          </p>
        )}
      </Card>
      <Card className="panel">
        <div className="panel-heading">
          <h2>Synchronization history</h2>
        </div>
        {jobs.isPending ? (
          <Loading />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} />
        ) : jobs.data.length ? (
          jobs.data.map((j) => (
            <div className="list-row" key={j.id}>
              <div className="grow">
                <strong>
                  {new Date(j.created_at).toLocaleString("en-GB", {
                    timeZone: "Asia/Colombo",
                  })}
                </strong>
                <p className="muted">
                  {j.records} records{j.error ? ` · ${j.error}` : ""}
                </p>
              </div>
              <Badge value={j.status} />
            </div>
          ))
        ) : (
          <Empty title="No sync runs yet" />
        )}
      </Card>
    </>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(0),
    logs = useRows("audit_logs", [], page);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Server-recorded actions. Audit records cannot be edited through the application."
      />
      <Card className="panel">
        {logs.isPending ? (
          <Loading />
        ) : logs.error ? (
          <ErrorState error={logs.error} />
        ) : logs.data.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Audit log, scroll for more columns"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time (Colombo)</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {new Date(l.created_at).toLocaleString("en-GB", {
                        timeZone: "Asia/Colombo",
                      })}
                    </TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell>{l.entity}</TableCell>
                    <TableCell className="mono">
                      {l.actor_id || "Deployment"}
                    </TableCell>
                    <TableCell className="mono">{l.record_id || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty title="No audit events" />
        )}
      </Card>
      <Pager page={page} setPage={setPage} count={logs.data?.length || 0} />
    </>
  );
}
export function NotificationsPage() {
  const { profile } = useAuth(),
    mine = profile!.role === "developer";
  const tasks = useRows("tasks", [
      { column: "status", value: "blocked" },
      ...(mine
        ? [
            {
              column: "assignee_id",
              op: "assigned" as const,
              value: profile!.id,
            },
          ]
        : []),
    ]),
    leave = useRows("leave_requests", [
      { column: "status", value: mine ? "approved" : "pending" },
      ...(mine ? [{ column: "developer_id", value: profile!.id }] : []),
    ]);
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Current items requiring attention, based on records you can access."
      />
      <Card className="panel">
        <div className="panel-heading">
          <h2>Blocked tasks</h2>
        </div>
        {tasks.isPending ? (
          <Loading />
        ) : tasks.error ? (
          <ErrorState error={tasks.error} />
        ) : tasks.data.length ? (
          tasks.data.map((l) => (
            <div className="list-row" key={l.id}>
              <div>
                <strong>{l.title}</strong>
                <p>{l.blocker || "This task needs attention."}</p>
              </div>
              <Button asChild variant="secondary">
                <a href={mine ? "/my-tasks" : "/admin/tasks"}>Open tasks</a>
              </Button>
            </div>
          ))
        ) : (
          <Empty title="No blocked tasks" />
        )}
      </Card>
      <Card className="panel">
        <div className="panel-heading">
          <h2>{mine ? "Approved leave" : "Leave awaiting review"}</h2>
        </div>
        {leave.error ? (
          <ErrorState error={leave.error} />
        ) : leave.data?.length ? (
          leave.data.map((l) => (
            <div key={l.id} className="list-row">
              <span>
                {dateLabel(l.starts_on)} to {dateLabel(l.ends_on)}
              </span>
              <Badge value={l.status} />
            </div>
          ))
        ) : (
          <Empty title="No leave notifications" />
        )}
      </Card>
    </>
  );
}
