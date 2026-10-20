import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus } from "lucide-react";
import { useAuth } from "../app/auth";
import { useAllRows, useCommand, useRows } from "../lib/api";
import {
  dateLabel,
  workingDaysBetween,
  leaveSchema,
  today,
} from "../lib/business";
import type { Leave } from "../types/database";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { LeaveCalendar } from "./leave-calendar";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Pager,
} from "../components/shared";
export function LeavePage({ admin = false }: { admin?: boolean }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false),
    [decision, setDecision] = useState<Leave>(),
    [note, setNote] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  const leaves = useRows(
      "leave_requests",
      [
        ...(!admin ? [{ column: "developer_id", value: profile!.id }] : []),
        ...(status ? [{ column: "status", value: status }] : []),
      ],
      page,
    ),
    people = useAllRows("profiles"),
    types = useAllRows("leave_types"),
    calendar = useAllRows("working_calendar_settings"),
    holidays = useAllRows("holidays"),
    mutation = useCommand();
  const form = useForm<z.infer<typeof leaveSchema>>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leave_type_id: "",
      starts_on: today(),
      ends_on: today(),
      half_day: false,
      reason: "",
    },
  });
  const submit = form.handleSubmit(async (payload) => {
    await mutation
      .mutateAsync({ action: "leave", payload })
      .then(() => {
        setOpen(false);
        form.reset();
      })
      .catch(() => {});
  });
  const days = (l: Leave) =>
    workingDaysBetween(
      l.starts_on,
      l.ends_on,
      calendar.data?.[0]?.working_days,
      holidays.data?.map((h) => h.holiday_date),
    ) * (l.half_day ? 0.5 : 1);
  return (
    <>
      <PageHeader
        title={admin ? "Leave management" : "My leave"}
        description="Plan time away. Keep team availability up to date."
        actions={
          <Button
            onClick={() => {
              mutation.reset();
              setOpen(true);
            }}
          >
            <Plus size={16} />
            Request leave
          </Button>
        }
      />
      <div className="notice">
        Only approved leave changes availability. Full-day leave expects 0
        hours, half-day leave expects 4. Tasks remain assigned until explicitly
        reassigned.
      </div>
      <div className="filters">
        <select
          aria-label="Filter leave status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All requests</option>
          {["pending", "approved", "rejected", "cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <section className="panel">
        {leaves.isPending ? (
          <Loading />
        ) : leaves.error ? (
          <ErrorState error={leaves.error} />
        ) : leaves.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Leave</th>
                  <th>Dates</th>
                  <th>Working days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.data.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>
                        {people.data?.find((p) => p.id === l.developer_id)
                          ?.name || "You"}
                      </strong>
                    </td>
                    <td>
                      {types.data?.find((t) => t.id === l.leave_type_id)
                        ?.name || "Leave"}
                      <small>{l.half_day ? "Half day" : "Full day"}</small>
                    </td>
                    <td>
                      {dateLabel(l.starts_on)}
                      <small>to {dateLabel(l.ends_on)}</small>
                    </td>
                    <td>{days(l)}</td>
                    <td>
                      <Badge value={l.status} />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          mutation.reset();
                          setDecision(l);
                          setNote("");
                        }}
                      >
                        View request
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No leave requests" />
        )}
      </section>
      <Pager page={page} setPage={setPage} count={leaves.data?.length || 0} />
      <LeaveCalendar />
      <Dialog open={open} onOpenChange={setOpen} title="Request leave">
        <form onSubmit={submit} className="form-grid">
          <Field
            label="Leave type"
            error={form.formState.errors.leave_type_id?.message}
          >
            <select {...form.register("leave_type_id")}>
              <option value="">Select type</option>
              {types.data
                ?.filter((t) => t.active)
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-row">
            <Field
              label="Start date"
              error={form.formState.errors.starts_on?.message}
            >
              <input type="date" {...form.register("starts_on")} />
            </Field>
            <Field
              label="End date"
              error={form.formState.errors.ends_on?.message}
            >
              <input type="date" {...form.register("ends_on")} />
            </Field>
          </div>
          <label className="check-row">
            <input type="checkbox" {...form.register("half_day")} />
            Half-day leave (one date only)
          </label>
          <Field label="Reason (optional)">
            <textarea {...form.register("reason")} maxLength={2000} />
          </Field>
          {mutation.error && <ErrorState error={mutation.error} />}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending}>Submit request</Button>
          </div>
        </form>
      </Dialog>
      {decision && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setDecision(undefined);
          }}
          title="Leave request"
        >
          <div className="detail-stack">
            <Badge value={decision.status} />
            <p>
              {dateLabel(decision.starts_on)} to {dateLabel(decision.ends_on)} ·{" "}
              {days(decision)} working days
            </p>
            <h3>Private reason</h3>
            <p className="preserve-lines">
              {decision.reason || "No reason provided."}
            </p>
            {decision.decision_note && (
              <p>Decision note: {decision.decision_note}</p>
            )}
            {admin &&
              decision.status === "pending" &&
              decision.developer_id !== profile!.id && (
                <>
                  <Field label="Decision note">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>
                  <div className="dialog-actions">
                    {["rejected", "approved"].map((s) => (
                      <Button
                        variant={s === "approved" ? "default" : "secondary"}
                        disabled={mutation.isPending}
                        key={s}
                        onClick={() =>
                          mutation.mutate(
                            {
                              action: "leave_decision",
                              payload: {
                                id: decision.id,
                                status: s,
                                decision_note: note,
                              },
                            },
                            { onSuccess: () => setDecision(undefined) },
                          )
                        }
                      >
                        {s === "approved" ? "Approve" : "Reject"}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            {["pending", "approved"].includes(decision.status) && (
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate(
                    {
                      action: "leave_decision",
                      payload: { id: decision.id, status: "cancelled" },
                    },
                    { onSuccess: () => setDecision(undefined) },
                  )
                }
              >
                Cancel request
              </Button>
            )}
            {mutation.error && <ErrorState error={mutation.error} />}
          </div>
        </Dialog>
      )}
    </>
  );
}
