import { useState } from "react";
import { useAuth } from "../app/auth";
import { useAllRows, useCommand, useRows, message } from "../lib/api";
import { client } from "../lib/supabase";
import { dateLabel, today } from "../lib/business";
import { Button } from "../components/ui/button";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Pager,
} from "../components/shared";
export function ProfilePage() {
  const { profile } = useAuth(),
    [name, setName] = useState(profile!.name),
    [job, setJob] = useState(profile!.job_title),
    [saved, setSaved] = useState(false),
    mutation = useCommand();
  return (
    <>
      <PageHeader
        title="My profile"
        description="Your display name and reporting role."
      />
      <section className="panel padded narrow">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              { action: "profile", payload: { name, job_title: job } },
              { onSuccess: () => setSaved(true) },
            );
          }}
        >
          <Field label="Name">
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Job title (shown in work reports)">
            <input
              required
              maxLength={120}
              value={job}
              onChange={(e) => setJob(e.target.value)}
            />
          </Field>
          <Field label="Work email">
            <input disabled value={profile!.email} />
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
      </section>
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
  return (
    <>
      <PageHeader
        title="Workspace settings"
        description="Working days, public holidays, and account eligibility."
      />
      {calendar.error && <ErrorState error={calendar.error} />}
      <div className="settings-grid">
        <section className="panel padded">
          <h2>Working calendar</h2>
          <p className="muted">
            Dates use Asia/Colombo. Nonworking dates do not create
            missing-update alerts.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
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
            }}
          >
            <div className="day-options">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (name, i) => (
                  <label
                    key={name}
                    className={
                      working.includes(i) ? "day-option checked" : "day-option"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={working.includes(i)}
                      onChange={(e) =>
                        setDays(
                          e.target.checked
                            ? [...working, i]
                            : working.filter((d) => d !== i),
                        )
                      }
                    />
                    {name}
                  </label>
                ),
              )}
            </div>
            <Field label="Allowed email domains (comma separated)">
              <input
                value={domains ?? current?.allowed_domains.join(", ") ?? ""}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="Leave empty to allow any domain"
                pattern="[a-zA-Z0-9.,\- ]*"
              />
            </Field>
            <Button disabled={mutation.isPending || !working.length}>
              Save calendar
            </Button>
          </form>
        </section>
        <section className="panel padded">
          <h2>Public holidays</h2>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(
                {
                  action: "holiday",
                  payload: { holiday_date: holiday, name: holidayName },
                },
                {
                  onSuccess: () => {
                    setHolidayName("");
                    setSaved("Holiday saved.");
                  },
                },
              );
            }}
          >
            <div className="form-row">
              <Field label="Date">
                <input
                  required
                  type="date"
                  value={holiday}
                  onChange={(e) => setHoliday(e.target.value)}
                />
              </Field>
              <Field label="Holiday name">
                <input
                  required
                  maxLength={120}
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
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
        </section>
        <section className="panel padded">
          <h2>Leave types</h2>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(
                { action: "leave_type", payload: { name: type } },
                { onSuccess: () => setType("") },
              );
            }}
          >
            <label className="sr-only" htmlFor="new-type">
              New leave type
            </label>
            <input
              id="new-type"
              required
              value={type}
              maxLength={120}
              onChange={(e) => setType(e.target.value)}
              placeholder="New leave type"
            />
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
        </section>
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
      <section className="panel padded narrow">
        <h2>Google Sheets</h2>
        <p className="muted">
          Configure service-account credentials as Edge Function secrets first.
          Share the spreadsheet with that account as an editor. SyncOra owns
          the five named reporting tabs.
        </p>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              {
                action: "integration",
                payload: {
                  enabled: enabled ?? config?.enabled ?? false,
                  spreadsheet_id: sheet ?? config?.spreadsheet_id ?? "",
                },
              },
              { onSuccess: () => setFeedback("Integration settings saved.") },
            );
          }}
        >
          <Field label="Spreadsheet ID">
            <input
              required={enabled ?? config?.enabled ?? false}
              value={sheet ?? config?.spreadsheet_id ?? ""}
              onChange={(e) => setSheet(e.target.value)}
              pattern="[a-zA-Z0-9_-]*"
            />
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={enabled ?? config?.enabled ?? false}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable Google Sheets synchronization
          </label>
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
      </section>
      <section className="panel">
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
      </section>
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
      <section className="panel">
        {logs.isPending ? (
          <Loading />
        ) : logs.error ? (
          <ErrorState error={logs.error} />
        ) : logs.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time (Colombo)</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {new Date(l.created_at).toLocaleString("en-GB", {
                        timeZone: "Asia/Colombo",
                      })}
                    </td>
                    <td>{l.action}</td>
                    <td>{l.entity}</td>
                    <td className="mono">{l.actor_id || "Deployment"}</td>
                    <td className="mono">{l.record_id || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No audit events" />
        )}
      </section>
      <Pager page={page} setPage={setPage} count={logs.data?.length || 0} />
    </>
  );
}
export function NotificationsPage() {
  const { profile } = useAuth(),
    mine = profile!.role === "developer";
  const logs = useRows("daily_work_logs", [
      { column: "status", value: mine ? "revision_requested" : "submitted" },
      ...(mine ? [{ column: "developer_id", value: profile!.id }] : []),
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
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {mine ? "Updates returned for revision" : "Updates awaiting review"}
          </h2>
        </div>
        {logs.isPending ? (
          <Loading />
        ) : logs.error ? (
          <ErrorState error={logs.error} />
        ) : logs.data.length ? (
          logs.data.map((l) => (
            <div className="list-row" key={l.id}>
              <div>
                <strong>{dateLabel(l.work_date)}</strong>
                <p>{l.review_note || "An update is ready for review."}</p>
              </div>
              <Button asChild variant="secondary">
                <a
                  href={
                    mine
                      ? `/my-updates/${l.work_date}`
                      : "/admin/evening-standup"
                  }
                >
                  Open update
                </a>
              </Button>
            </div>
          ))
        ) : (
          <Empty title="No updates need attention" />
        )}
      </section>
      <section className="panel">
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
      </section>
    </>
  );
}
