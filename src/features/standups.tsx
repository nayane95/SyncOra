import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select";
import { Input } from "../components/ui/input";
import { useValidatedForm } from "../lib/use-validated-form";
import { meetingSchema } from "../lib/form-schemas";
import { useState } from "react";
import {
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ListTodo,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import { useAllRows, useCommand } from "../lib/api";
import {
  attendanceFor,
  localDate,
  previousWorkday,
  today,
} from "../lib/business";
import { TaskList } from "./tasks";
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

export function StandupPage({ evening = false }: { evening?: boolean }) {
  const [memberSearch, setMemberSearch] = useState("");
  const [workView, setWorkView] = useState("all");
  const [date, setDate] = useState(today()),
    [team, setTeam] = useState(""),
    [selected, setSelected] = useState(""),
    [notes, setNotes] = useState<string | null>(null),
    [saved, setSaved] = useState("");
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
  const personalTasks = (id: string) =>
    (tasks.data || []).filter(
      (t) =>
        t.assignee_id === id ||
        contributors.data?.some(
          (c) => c.task_id === t.id && c.developer_id === id,
        ),
    );
  const personal = person ? personalTasks(person.id) : [];
  const period = evening ? "evening" : "morning",
    session = sessions.data?.find((s) => s.period === period);
  const attendance = (id: string) =>
    attendanceFor(
      date,
      leaves.data?.filter((l) => l.developer_id === id) || [],
      calendar.data?.[0]?.working_days,
      holidays.data?.map((h) => h.holiday_date),
    );
  let completedDate = date;
  if (!evening) {
    try {
      completedDate = previousWorkday(
        date,
        calendar.data?.[0]?.working_days,
        holidays.data?.map((h) => h.holiday_date),
      );
    } catch {
      completedDate = "";
    }
  }
  const groups = [
    {
      key: "planned",
      title: "To do",
      icon: ListTodo,
      items: personal.filter((t) => ["planned", "backlog"].includes(t.status)),
    },
    {
      key: "in_progress",
      title: "In progress",
      icon: CircleDot,
      items: personal.filter((t) => t.status === "in_progress"),
    },
    {
      key: "blocked",
      title: "Blocked work",
      icon: TriangleAlert,
      items: personal.filter((t) => t.status === "blocked"),
    },
    {
      key: "completed",
      title: evening ? "Completed today" : "Completed last working day",
      icon: CheckCircle2,
      items: personal.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          localDate(t.completed_at) === completedDate,
      ),
    },
  ];
  const matchingMembers = roster.filter((p) =>
    p.name.toLowerCase().includes(memberSearch.trim().toLowerCase()),
  );
  const memberIndex = matchingMembers.findIndex((p) => p.id === person?.id);
  const selectMember = (id: string) => {
    setSelected(id);
    setWorkView("all");
  };
  const visibleGroups = groups.filter((group) =>
    workView === "all" ? group.items.length > 0 : group.key === workView,
  );
  const error =
    teams.error ||
    people.error ||
    memberships.error ||
    calendar.error ||
    holidays.error ||
    contributors.error ||
    tasks.error ||
    leaves.error ||
    sessions.error;
  const loading =
    teams.isPending ||
    people.isPending ||
    memberships.isPending ||
    calendar.isPending ||
    holidays.isPending ||
    contributors.isPending ||
    (!!teamId && (tasks.isPending || leaves.isPending || sessions.isPending));
  const meetingForm = useValidatedForm(meetingSchema, {
    date,
    team: teamId,
    notes: notes ?? session?.notes ?? "",
  });
  function confirm(state: "draft" | "confirmed") {
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
  }
  return (
    <div className="standup-workspace">
      <PageHeader
        title={evening ? "Evening standup" : "Morning standup"}
        description="Discuss task progress, blockers, and next steps with each developer."
        actions={
          <>
            <Field
              label="Meeting date"
              error={meetingForm.formState.errors.date?.message}
            >
              <Input
                aria-label="Meeting date"
                type="date"
                value={date}
                {...meetingForm.register("date", {
                  onChange: (e) => {
                    setDate(e.target.value);
                    setNotes(null);
                    setSaved("");
                  },
                })}
              />
            </Field>
            <Field
              label="Meeting team"
              error={meetingForm.formState.errors.team?.message}
            >
              <NativeSelect
                aria-label="Meeting team"
                value={teamId}
                {...meetingForm.register("team", {
                  onChange: (e) => {
                    setTeam(e.target.value);
                    setSelected("");
                    setNotes(null);
                    setSaved("");
                  },
                })}
              >
                {teams.data
                  ?.filter((t) => !t.archived)
                  .map((t) => (
                    <NativeSelectOption key={t.id} value={t.id}>
                      {t.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </Field>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <Loading />
      ) : !teamId ? (
        <Empty title="Create your first team">
          Add a team and its members before running a standup.
        </Empty>
      ) : (
        <>
          <div className="standup-metrics">
            <Metrics
              items={[
                { label: "Team members", value: roster.length },
                {
                  label: "In progress",
                  value:
                    tasks.data?.filter((t) => t.status === "in_progress")
                      .length || 0,
                },
                {
                  label: "Blocked tasks",
                  value:
                    tasks.data?.filter((t) => t.status === "blocked").length ||
                    0,
                },
                {
                  label: evening
                    ? "Completed today"
                    : "Completed last working day",
                  value:
                    tasks.data?.filter(
                      (t) =>
                        t.status === "completed" &&
                        t.completed_at &&
                        localDate(t.completed_at) === completedDate,
                    ).length || 0,
                },
              ]}
            />
          </div>
          <div className="meeting-grid">
            <Card className="panel roster" role="complementary">
              <div className="panel-heading">
                <h2>Team members</h2>
                <span className="muted">{roster.length}</span>
              </div>
              <div className="standup-member-search">
                <Search size={16} aria-hidden="true" />
                <Input
                  aria-label="Search meeting members"
                  placeholder="Find a member…"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                />
              </div>
              {matchingMembers.length ? (
                matchingMembers.map((p) => (
                  <Button
                    variant="ghost"
                    key={p.id}
                    className={`roster-person ${p.id === person?.id ? "selected" : ""}`}
                    onClick={() => selectMember(p.id)}
                    aria-pressed={p.id === person?.id}
                  >
                    <Avatar name={p.name} src={p.avatar_url || undefined} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {attendance(p.id).attendance === "on_leave"
                          ? "On leave"
                          : `${personalTasks(p.id).filter((t) => t.status === "in_progress").length} in progress · ${personalTasks(p.id).filter((t) => t.status === "blocked").length} blocked`}
                      </small>
                    </span>
                  </Button>
                ))
              ) : (
                <Empty
                  title={
                    roster.length ? "No matching members" : "No members yet"
                  }
                />
              )}
            </Card>
            <Card className="panel meeting-detail">
              {person ? (
                <>
                  <div className="meeting-person">
                    <div className="toolbar">
                      <Avatar
                        name={person.name}
                        src={person.avatar_url || undefined}
                      />
                      <div>
                        <h2>{person.name}</h2>
                        <p className="muted">
                          {teams.data?.find((t) => t.id === teamId)?.name}
                        </p>
                      </div>
                    </div>
                    <div className="standup-person-controls">
                      <Badge value={attendance(person.id).attendance} />
                      <div className="toolbar">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Previous member"
                          disabled={memberIndex <= 0}
                          onClick={() =>
                            selectMember(matchingMembers[memberIndex - 1].id)
                          }
                        >
                          <ChevronLeft size={16} />
                        </Button>
                        <span className="muted">
                          {memberIndex >= 0
                            ? `${memberIndex + 1} / ${matchingMembers.length}`
                            : "Selected member"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Next member"
                          disabled={
                            memberIndex < 0 ||
                            memberIndex >= matchingMembers.length - 1
                          }
                          onClick={() =>
                            selectMember(matchingMembers[memberIndex + 1].id)
                          }
                        >
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Tabs
                    value={workView}
                    onValueChange={setWorkView}
                    className="standup-task-tabs"
                  >
                    <TabsList aria-label="Member task groups">
                      <TabsTrigger value="all">
                        All tasks{" "}
                        <span>
                          {groups.reduce(
                            (sum, group) => sum + group.items.length,
                            0,
                          )}
                        </span>
                      </TabsTrigger>
                      {groups.map(({ key, title, icon: Icon, items }) => (
                        <TabsTrigger key={key} value={key} data-status={key}>
                          <Icon size={14} aria-hidden="true" />
                          {key === "completed"
                            ? "Done"
                            : key === "blocked"
                              ? "Blocked"
                              : title}
                          <span>{items.length}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent value={workView}>
                      {!visibleGroups.length && (
                        <Empty title="No current tasks">
                          This member has no open work or completions for the
                          selected meeting period.
                        </Empty>
                      )}
                      {visibleGroups.map((group) => (
                        <div
                          className={`task-group standup-group-${group.key}`}
                          key={group.title}
                        >
                          <div className="section-heading">
                            <h3>
                              {group.title}
                              <span className="count">
                                {group.items.length}
                              </span>
                            </h3>
                          </div>
                          {group.items.length ? (
                            <TaskList tasks={group.items} compact />
                          ) : (
                            <p className="group-empty">
                              No tasks in this group.
                            </p>
                          )}
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <Empty title="Select a team member" />
              )}
            </Card>
          </div>
          <Card className="panel padded meeting-notes">
            <div className="panel-heading">
              <h2>Meeting notes & confirmation</h2>
              <Badge value={session?.state || "draft"} />
            </div>
            <Field
              label="Notes"
              error={meetingForm.formState.errors.notes?.message}
            >
              <Textarea
                value={notes ?? session?.notes ?? ""}
                {...meetingForm.register("notes", {
                  onChange: (e) => setNotes(e.target.value),
                })}
                placeholder="Shared decisions and follow-ups from this meeting"
                rows={3}
              />
            </Field>
            <div className="dialog-actions">
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={meetingForm.handleSubmit(() => confirm("draft"))}
              >
                Save draft
              </Button>
              <Button
                disabled={mutation.isPending || !roster.length}
                onClick={meetingForm.handleSubmit(() => confirm("confirmed"))}
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
          </Card>
        </>
      )}
    </div>
  );
}
