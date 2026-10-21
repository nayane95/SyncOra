import { DeveloperCompletionHeatmap } from "../components/developer-completion-heatmap";
import { useState } from "react";
import { ChevronDown, Search, TriangleAlert } from "lucide-react";
import { Card } from "../components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth";
import { useAllRows } from "../lib/api";
import { today } from "../lib/business";
import { TaskList, TasksPage } from "./tasks";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import {
  Avatar,
  Empty,
  ErrorState,
  Loading,
  Metrics,
  PageHeader,
} from "../components/shared";

export function Dashboard() {
  const { profile } = useAuth();
  return profile?.role === "developer" ? <TasksPage mine /> : <TeamOverview />;
}

function TeamOverview() {
  const tasks = useAllRows("tasks"),
    people = useAllRows("profiles"),
    teams = useAllRows("teams"),
    memberships = useAllRows("team_memberships");
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const date = today();
  const error = tasks.error || people.error || teams.error || memberships.error;
  const active =
    people.data?.filter(
      (p) => p.role === "developer" && p.status === "active",
    ) || [];
  const current =
    tasks.data?.filter((t) => !["completed", "cancelled"].includes(t.status)) ||
    [];
  const activeTeams = teams.data?.filter((team) => !team.archived) || [];
  const blocked = current.filter((task) => task.status === "blocked");
  const roster = active
    .map((person) => {
      const work = current.filter((task) => task.assignee_id === person.id);
      const teamIds =
        memberships.data
          ?.filter(
            (m) =>
              m.developer_id === person.id &&
              m.starts_on <= date &&
              (!m.ends_on || m.ends_on > date),
          )
          .map((m) => m.team_id) || [];
      return {
        person,
        work,
        teamIds,
        blocked: work.filter((task) => task.status === "blocked").length,
        progressing: work.filter((task) => task.status === "in_progress")
          .length,
      };
    })
    .filter(
      (row) =>
        row.person.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        (!teamId || row.teamIds.includes(teamId)),
    )
    .sort(
      (a, b) =>
        b.blocked - a.blocked || a.person.name.localeCompare(b.person.name),
    );
  return (
    <div className="team-overview">
      <PageHeader
        title="Team overview"
        description="See who is working on what and where the team needs help."
        actions={
          <Button asChild>
            <Link to="/admin/morning-standup">Open standup</Link>
          </Button>
        }
      />
      {tasks.isPending ||
      people.isPending ||
      teams.isPending ||
      memberships.isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <>
          <Metrics
            items={[
              { label: "Active developers", value: active.length },
              {
                label: "To do",
                value: current.filter((t) =>
                  ["planned", "backlog"].includes(t.status),
                ).length,
              },
              {
                label: "In progress",
                value: current.filter((t) => t.status === "in_progress").length,
              },
              { label: "Blocked", value: blocked.length },
            ]}
          />
          <div className="overview-layout">
            <Card className="panel overview-roster">
              <div className="panel-heading">
                <div>
                  <h2>Developer workload</h2>
                  <p className="muted">
                    Blocked work first. Expand a developer to review their
                    tasks.
                  </p>
                </div>
                <span className="muted">
                  {roster.length} of {active.length}
                </span>
              </div>
              <div className="overview-filters">
                <div className="overview-search">
                  <Search size={16} aria-hidden="true" />
                  <Input
                    aria-label="Search developers"
                    placeholder="Search developers…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <NativeSelect
                  aria-label="Developer team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  <NativeSelectOption value="">All teams</NativeSelectOption>
                  {activeTeams.map((team) => (
                    <NativeSelectOption key={team.id} value={team.id}>
                      {team.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {(search || teamId) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setTeamId("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="overview-roster-labels" aria-hidden="true">
                <span>Developer / team</span>
                <span>In progress</span>
                <span>Blocked</span>
                <span>Open</span>
                <span />
              </div>
              {roster.map(({ person, work, teamIds, blocked, progressing }) => (
                <Collapsible key={person.id} className="overview-person">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="overview-person-trigger">
                      <span className="overview-person-identity">
                        <Avatar
                          name={person.name}
                          src={person.avatar_url || undefined}
                        />
                        <span>
                          <strong>{person.name}</strong>
                          <span className="muted">
                            {teamIds
                              .map(
                                (id) =>
                                  teams.data?.find((team) => team.id === id)
                                    ?.name,
                              )
                              .filter(Boolean)
                              .join(", ") || "No team assigned"}
                          </span>
                        </span>
                      </span>
                      <span className="overview-work-count">
                        <span className="overview-mobile-label">
                          In progress{" "}
                        </span>
                        {progressing}
                      </span>
                      <span
                        className={`overview-work-count ${blocked ? "overview-blocked" : ""}`}
                      >
                        <span className="overview-mobile-label">Blocked </span>
                        {blocked}
                      </span>
                      <span className="overview-work-count">
                        <span className="overview-mobile-label">Open </span>
                        {work.length}
                      </span>
                      <ChevronDown
                        size={16}
                        className="overview-expand"
                        aria-hidden="true"
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overview-person-tasks">
                    <DeveloperCompletionHeatmap
                      developerId={person.id}
                      name={person.name}
                    />
                    {work.length ? (
                      <TaskList
                        tasks={[...work].sort(
                          (a, b) =>
                            Number(b.status === "blocked") -
                            Number(a.status === "blocked"),
                        )}
                        compact
                      />
                    ) : (
                      <p className="muted">No open tasks assigned.</p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
              {!roster.length && (
                <Empty
                  title={
                    active.length
                      ? "No matching developers"
                      : "No active developers"
                  }
                >
                  {active.length
                    ? "Try a different name or clear the team filter."
                    : "Approved developers will appear here once their accounts are active."}
                </Empty>
              )}
              <div className="overview-panel-footer">
                <Button asChild variant="outline">
                  <Link to="/admin/tasks">Open task register</Link>
                </Button>
              </div>
            </Card>
            <aside
              className="overview-sidebar"
              aria-label="Team summaries and blocked work"
            >
              <Card className="panel">
                <div className="panel-heading">
                  <h2>Teams</h2>
                  <span className="muted">{activeTeams.length}</span>
                </div>
                {activeTeams.map((team) => {
                  const work = current.filter(
                    (task) => task.team_id === team.id,
                  );
                  const blocked = work.filter(
                    (task) => task.status === "blocked",
                  ).length;
                  return (
                    <div className="overview-team" key={team.id}>
                      <div>
                        <strong>{team.name}</strong>
                        <span className="muted">{work.length} open tasks</span>
                      </div>
                      <div className="overview-team-counts">
                        <span>
                          {
                            work.filter((task) => task.status === "in_progress")
                              .length
                          }{" "}
                          in progress
                        </span>
                        <span className={blocked ? "overview-blocked" : ""}>
                          {blocked} blocked
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!activeTeams.length && (
                  <Empty title="No active teams">
                    Create or restore a team from Teams.
                  </Empty>
                )}
              </Card>
              <Card className="panel">
                <div className="panel-heading">
                  <h2 className="overview-attention-title">
                    <TriangleAlert size={17} aria-hidden="true" />
                    Needs attention
                  </h2>
                  <span className="muted">{blocked.length}</span>
                </div>
                {blocked.slice(0, 4).map((task) => (
                  <div className="overview-blocker" key={task.id}>
                    <strong>{task.title}</strong>
                    <p>{task.blocker || "No blocker details added yet."}</p>
                    <span className="muted">
                      {people.data?.find(
                        (person) => person.id === task.assignee_id,
                      )?.name || "Unassigned"}
                    </span>
                  </div>
                ))}
                {!blocked.length && (
                  <p className="overview-clear muted">
                    No blocked tasks. Review developer updates in your standup.
                  </p>
                )}
                {blocked.length > 4 && (
                  <p className="overview-clear muted">
                    {blocked.length - 4} more blocked tasks in the task
                    register.
                  </p>
                )}
                {!!blocked.length && (
                  <div className="overview-panel-footer">
                    <Button asChild variant="outline">
                      <Link to="/admin/morning-standup">Discuss blockers</Link>
                    </Button>
                  </div>
                )}
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
