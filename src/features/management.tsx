import { AddTeamMemberPopover } from "./team-member-popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { PersonPicker } from "../components/ui/person-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../components/ui/collapsible";
import { Link } from "react-router-dom";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useValidatedForm } from "../lib/use-validated-form";
import {
  nameSchema,
  membershipSchema,
  accountSchema,
  projectAccessSchema,
} from "../lib/form-schemas";
import { useEffect, useState, type ReactNode } from "react";
import {
  Plus,
  Archive,
  Pencil,
  UserPlus,
  Users,
  Settings2,
  FolderKanban,
  History,
  ChevronRight,
  Search,
} from "lucide-react";
import { useAuth } from "../app/auth";
import { useAllRows, useCommand } from "../lib/api";
import { dateLabel, today } from "../lib/business";
import type { Profile, Team, Project, Module } from "../types/database";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  ProjectTag,
} from "../components/shared";
function NameEditor({
  action,
  record,
  extra = {},
  onClose,
  children,
}: {
  action: "team" | "project" | "module" | "leave_type";
  record?: Team | Project | Module;
  extra?: object;
  children?: ReactNode;
  onClose: () => void;
}) {
  const [name, setName] = useState(record?.name || ""),
    mutation = useCommand();
  const form = useValidatedForm(nameSchema, { name });
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`${record ? (action === "team" ? "Edit" : "Rename") : "Create"} ${action.replaceAll("_", " ")}`}
    >
      <form
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          mutation.mutate(
            {
              action,
              payload: {
                id: record?.id,
                name: values.name,
                archived: record?.archived || false,
                ...extra,
              },
            },
            { onSuccess: onClose },
          );
        })}
      >
        <Field label="Name" error={form.formState.errors.name?.message}>
          <Input
            autoFocus
            required
            maxLength={120}
            value={name}
            {...form.register("name", {
              onChange: (e) => setName(e.target.value),
            })}
          />
        </Field>
        {children}
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending}>
            Save {action.replaceAll("_", " ")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
function TeamManagementDrawer({
  team,
  onClose,
  onMember,
  children,
}: {
  team: Team;
  onClose: () => void;
  onMember: (id?: string, lead?: boolean) => void;
  children: ReactNode;
}) {
  const people = useAllRows("profiles"),
    members = useAllRows("team_memberships"),
    projects = useAllRows("projects"),
    access = useAllRows("project_memberships");
  const [name, setName] = useState(team.name);
  const [tab, setTab] = useState("details");
  const [notice, setNotice] = useState("");
  const mutation = useCommand();
  const form = useValidatedForm(nameSchema, { name });
  const current =
    members.data?.filter(
      (m) =>
        m.team_id === team.id &&
        m.starts_on <= today() &&
        (!m.ends_on || m.ends_on > today()),
    ) || [];
  const history = members.data?.filter((m) => m.team_id === team.id) || [];
  const error = people.error || members.error || projects.error || access.error;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="team-management-sheet">
        <SheetHeader>
          <SheetTitle>Manage team</SheetTitle>
          <SheetDescription>
            {team.name} · {current.length}{" "}
            {current.length === 1 ? "member" : "members"} ·{" "}
            {team.archived ? "Archived" : "Active"}
          </SheetDescription>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="team-editor-tabs">
          <TabsList
            className="team-editor-nav"
            aria-label="Team management sections"
          >
            {[
              { title: "Details", icon: Settings2 },
              { title: "Members", icon: Users },
              { title: "Projects", icon: FolderKanban },
              { title: "History", icon: History },
            ].map(({ title, icon: Icon }) => (
              <TabsTrigger
                key={title}
                value={title.toLowerCase()}
                data-section={title.toLowerCase()}
              >
                <Icon size={15} aria-hidden="true" />
                {title}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="sheet-body">
            {error ? (
              <ErrorState error={error} />
            ) : people.isPending ||
              members.isPending ||
              projects.isPending ||
              access.isPending ? (
              <Loading />
            ) : (
              <>
                <TabsContent value="details">
                  <section
                    id="team-section-details"
                    className="team-editor-section"
                  >
                    <h3>Team details</h3>
                    <form
                      className="form-grid"
                      noValidate
                      onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(
                          {
                            action: "team",
                            payload: { ...team, name: values.name },
                          },
                          { onSuccess: () => setNotice("Team details saved.") },
                        ),
                      )}
                    >
                      <Field
                        label="Team name"
                        error={form.formState.errors.name?.message}
                      >
                        <Input
                          required
                          maxLength={120}
                          value={name}
                          {...form.register("name", {
                            onChange: (event) => setName(event.target.value),
                          })}
                        />
                      </Field>
                      <Button disabled={mutation.isPending}>Save team</Button>
                    </form>
                  </section>
                  <section className="team-editor-section">
                    <h3>{team.archived ? "Restore team" : "Archive team"}</h3>
                    <p className="muted">
                      {team.archived
                        ? "Restore this team to make it available for new memberships."
                        : "Hide this team from active lists. Existing work and membership history are retained."}
                    </p>
                    <Button
                      variant="secondary"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate(
                          {
                            action: "team",
                            payload: { ...team, archived: !team.archived },
                          },
                          {
                            onSuccess: () =>
                              setNotice(
                                team.archived
                                  ? "Team restored."
                                  : "Team archived.",
                              ),
                          },
                        )
                      }
                    >
                      <Archive size={16} />
                      {team.archived ? "Restore team" : "Archive team"}
                    </Button>
                  </section>
                </TabsContent>
                <TabsContent value="members">
                  <section className="team-editor-section">
                    <div
                      id="team-section-members"
                      className="team-editor-section-heading"
                    >
                      <h3>
                        Members{" "}
                        <span className="muted">({current.length})</span>
                      </h3>
                      <AddTeamMemberPopover team={team} />
                    </div>
                    <p className="muted">
                      Edit a member to change their team or lead role, or remove
                      their current membership. Previous work keeps its original
                      team.
                    </p>
                    {current.map((m) => {
                      const person = people.data?.find(
                        (p) => p.id === m.developer_id,
                      );
                      return (
                        <div className="list-row" key={m.id}>
                          <Avatar
                            name={person?.name || "Team member"}
                            src={person?.avatar_url || undefined}
                          />
                          <div className="grow">
                            <strong>{person?.name || "Team member"}</strong>
                            <p className="muted">
                              {m.is_lead ? "Team lead" : "Member"} · since{" "}
                              {dateLabel(m.starts_on)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => onMember(m.developer_id, m.is_lead)}
                          >
                            Edit member
                          </Button>
                        </div>
                      );
                    })}
                    {!current.length && (
                      <p className="muted">No active members yet.</p>
                    )}
                  </section>
                  {children}
                </TabsContent>
                <TabsContent value="projects">
                  <section className="team-editor-section">
                    <h3 id="team-section-projects">Project access</h3>
                    <p className="muted">
                      Members can work on all linked projects at the same time.
                    </p>
                    {projects.data
                      ?.filter(
                        (p) =>
                          !p.archived ||
                          access.data?.some(
                            (a) =>
                              a.team_id === team.id && a.project_id === p.id,
                          ),
                      )
                      .map((p) => {
                        const linked = access.data?.some(
                          (a) => a.team_id === team.id && a.project_id === p.id,
                        );
                        return (
                          <div className="list-row" key={p.id}>
                            <div className="grow">
                              <ProjectTag id={p.id} name={p.name} />
                              <p className="muted">
                                {linked ? "Team has access" : "Not linked"}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              disabled={
                                mutation.isPending ||
                                (!linked && (team.archived || p.archived))
                              }
                              onClick={() =>
                                mutation.mutate(
                                  {
                                    action: "project_membership",
                                    payload: {
                                      project_id: p.id,
                                      team_id: team.id,
                                      remove: !!linked,
                                    },
                                  },
                                  {
                                    onSuccess: () =>
                                      setNotice(
                                        linked
                                          ? "Project access removed."
                                          : "Project access granted.",
                                      ),
                                  },
                                )
                              }
                            >
                              {linked ? "Remove access" : "Grant access"}
                            </Button>
                          </div>
                        );
                      })}
                    {!projects.data?.length && (
                      <p className="muted">No projects available.</p>
                    )}
                  </section>
                </TabsContent>
                <TabsContent value="history">
                  <section className="team-editor-section">
                    <Collapsible defaultOpen id="team-section-history">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="history-toggle">
                          <ChevronRight size={16} />
                          Membership history ({history.length})
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ol className="team-membership-timeline">
                          {[...history]
                            .sort((a, b) =>
                              b.starts_on.localeCompare(a.starts_on),
                            )
                            .map((m) => (
                              <li key={m.id}>
                                <strong>
                                  {people.data?.find(
                                    (p) => p.id === m.developer_id,
                                  )?.name || "Team member"}
                                </strong>
                                <p className="muted">
                                  {m.is_lead ? "Team lead" : "Member"} ·{" "}
                                  {dateLabel(m.starts_on)} —{" "}
                                  {m.ends_on ? dateLabel(m.ends_on) : "Present"}
                                </p>
                              </li>
                            ))}
                        </ol>
                      </CollapsibleContent>
                    </Collapsible>
                  </section>
                </TabsContent>
                {mutation.error && <ErrorState error={mutation.error} />}
                <p role="status" className="muted">
                  {notice}
                </p>
              </>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
export function TeamsPage() {
  const { profile } = useAuth(),
    superAdmin = profile!.role === "super_admin";
  const teams = useAllRows("teams"),
    people = useAllRows("profiles"),
    members = useAllRows("team_memberships"),
    projects = useAllRows("projects"),
    projectAccess = useAllRows("project_memberships"),
    tasks = useAllRows("tasks");
  const [search, setSearch] = useState("");
  const [teamStatus, setTeamStatus] = useState("active");
  const [editor, setEditor] = useState<Team | "new">(),
    [membership, setMembership] = useState(false),
    [developer, setDeveloper] = useState(""),
    [team, setTeam] = useState(""),
    [lead, setLead] = useState(false),
    mutation = useCommand();
  const memberForm = useValidatedForm(
    membershipSchema.refine(
      (v) =>
        !v.lead ||
        ["admin", "super_admin"].includes(
          people.data?.find((p) => p.id === v.developer)?.role || "",
        ),
      {
        path: ["lead"],
        message: "Team leads must have an Admin or Super Admin role",
      },
    ),
    {
      developer,
      team,
      lead,
    },
  );
  const current =
    members.data?.filter(
      (m) => m.starts_on <= today() && (!m.ends_on || m.ends_on > today()),
    ) || [];
  const visibleTeams =
    teams.data?.filter(
      (t) =>
        (teamStatus === "all" || t.archived === (teamStatus === "archived")) &&
        (t.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          current.some(
            (m) =>
              m.team_id === t.id &&
              people.data?.some(
                (p) =>
                  p.id === m.developer_id &&
                  p.name.toLowerCase().includes(search.trim().toLowerCase()),
              ),
          )),
    ) || [];
  function editMembership(teamId = "", developerId = "", isLead = false) {
    memberForm.clearErrors();
    mutation.reset();
    setTeam(teamId);
    setDeveloper(developerId);
    setLead(isLead);
    setMembership(true);
  }
  useEffect(() => {
    if (membership && editor && editor !== "new")
      document
        .getElementById("team-membership-editor")
        ?.scrollIntoView({ block: "start" });
  }, [membership, developer, editor]);
  const membershipForm = (
    <form
      className="form-grid"
      noValidate
      onSubmit={memberForm.handleSubmit(() => {
        mutation.mutate(
          {
            action: "membership",
            payload: {
              developer_id: developer,
              team_id: team || null,
              is_lead: lead,
            },
          },
          { onSuccess: () => setMembership(false) },
        );
      })}
    >
      <Controller
        control={memberForm.control}
        name="developer"
        render={({ field }) => (
          <Field
            label="Team member"
            error={memberForm.formState.errors.developer?.message}
          >
            <PersonPicker
              required
              people={people.data?.filter((p) => p.status === "active") || []}
              value={field.value}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              onChange={(id) => {
                field.onChange(id);
                setDeveloper(id);
              }}
            />
          </Field>
        )}
      />
      <Field label="Team" error={memberForm.formState.errors.team?.message}>
        <NativeSelect
          value={team}
          {...memberForm.register("team", {
            onChange: (e) => setTeam(e.target.value),
          })}
        >
          <NativeSelectOption value="">
            Remove from current team
          </NativeSelectOption>
          {teams.data
            ?.filter((t) => !t.archived)
            .map((t) => (
              <NativeSelectOption value={t.id} key={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </Field>
      <Label className="check-row">
        <Controller
          control={memberForm.control}
          name="lead"
          render={({ field }) => (
            <Checkbox
              name={field.name}
              ref={field.ref}
              checked={field.value}
              onBlur={field.onBlur}
              onCheckedChange={(value) => {
                field.onChange(value === true);
                setLead(value === true);
              }}
              aria-invalid={!!memberForm.formState.errors.lead}
              aria-describedby={
                memberForm.formState.errors.lead ? "team-lead-error" : undefined
              }
            />
          )}
        />
        Team lead (requires Admin role)
      </Label>
      {memberForm.formState.errors.lead && (
        <p id="team-lead-error" className="field-error" role="alert">
          {memberForm.formState.errors.lead.message}
        </p>
      )}
      {mutation.error && <ErrorState error={mutation.error} />}
      <Button disabled={mutation.isPending}>Save membership</Button>
    </form>
  );
  return (
    <div className="teams-page">
      <PageHeader
        title="Teams"
        description="Find your team, manage members and see the projects they can work on together."
        actions={
          superAdmin && (
            <>
              <Button variant="secondary" onClick={() => editMembership()}>
                <UserPlus size={16} />
                Manage membership
              </Button>
              <Button onClick={() => setEditor("new")}>
                <Plus size={16} />
                Create team
              </Button>
            </>
          )
        }
      />
      <Card className="panel padded teams-toolbar">
        <div className="teams-search">
          <Search size={17} aria-hidden="true" />
          <Input
            aria-label="Search teams or members"
            placeholder="Search teams or members…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Team visibility"
          value={teamStatus}
          onChange={(event) => setTeamStatus(event.target.value)}
        >
          <NativeSelectOption value="active">Active teams</NativeSelectOption>
          <NativeSelectOption value="archived">
            Archived teams
          </NativeSelectOption>
          <NativeSelectOption value="all">All teams</NativeSelectOption>
        </NativeSelect>
        <span className="muted">
          {visibleTeams.length} {visibleTeams.length === 1 ? "team" : "teams"}
        </span>
        {(search || teamStatus !== "active") && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setTeamStatus("active");
            }}
          >
            Clear filters
          </Button>
        )}
      </Card>
      <p className="muted teams-project-note">
        Members can work on multiple linked projects at the same time.{" "}
        <Link to="/admin/projects">Manage project access</Link>
      </p>
      {mutation.error && <ErrorState error={mutation.error} />}
      {teams.isPending ||
      members.isPending ||
      people.isPending ||
      projects.isPending ||
      projectAccess.isPending ? (
        <Loading />
      ) : teams.error ||
        members.error ||
        people.error ||
        projects.error ||
        projectAccess.error ? (
        <ErrorState
          error={
            teams.error ||
            members.error ||
            people.error ||
            projects.error ||
            projectAccess.error
          }
        />
      ) : visibleTeams.length ? (
        <div className="team-grid">
          {visibleTeams.map((t) => {
            const roster = current.filter((m) => m.team_id === t.id);
            const linked =
              projectAccess.data?.filter((item) => item.team_id === t.id) || [];
            const work =
              tasks.data?.filter(
                (task) => task.team_id === t.id && task.status !== "cancelled",
              ) || [];
            const completed = work.filter(
              (task) => task.status === "completed",
            ).length;
            const percent = work.length
              ? Math.round((completed / work.length) * 100)
              : 0;
            const leads = roster
              .filter((m) => m.is_lead)
              .map(
                (m) => people.data?.find((p) => p.id === m.developer_id)?.name,
              )
              .filter(Boolean);
            const manage = () => {
              setMembership(false);
              mutation.reset();
              setEditor(t);
            };
            return (
              <Card
                className="panel team-summary-card"
                key={t.id}
              >
                <div className="team-summary-body">
                  <div className="team-summary-heading">
                    <div className="team-summary-identity">
                      <span className="team-identity-symbol" aria-hidden="true">
                        <Users size={20} />
                      </span>
                      <div>
                        <h2>{t.name}</h2>
                        <p className="muted">
                          {roster.length}{" "}
                          {roster.length === 1 ? "member" : "members"} ·{" "}
                          {linked.length}{" "}
                          {linked.length === 1 ? "project" : "projects"}
                        </p>
                      </div>
                    </div>
                    <Badge value={t.archived ? "archived" : "active"} />
                  </div>
                  <div className="team-summary-people">
                    <div
                      className="team-avatar-stack"
                      aria-label={`${roster.length} team members`}
                    >
                      {roster.slice(0, 5).map((member) => {
                        const person = people.data?.find(
                          (p) => p.id === member.developer_id,
                        );
                        return (
                          <span
                            key={member.id}
                            title={`${person?.name || "Team member"}${member.is_lead ? " · Team lead" : ""}`}
                            className={
                              member.is_lead ? "team-avatar-lead" : undefined
                            }
                          >
                            <Avatar
                              name={person?.name || "Team member"}
                              src={person?.avatar_url || undefined}
                            />
                          </span>
                        );
                      })}
                      {roster.length > 5 && (
                        <span className="team-avatar-more">
                          +{roster.length - 5}
                        </span>
                      )}
                      {!roster.length && (
                        <span className="muted">No members yet</span>
                      )}
                    </div>
                    <div className="team-summary-lead">
                      <span className="muted">Team lead</span>
                      <strong>{leads.join(", ") || "Not assigned"}</strong>
                    </div>
                  </div>
                  <div className="team-summary-projects">
                    <h3>Assigned projects</h3>
                    <div>
                      {linked.slice(0, 2).map((item) => (
                        <ProjectTag
                          key={item.id}
                          id={item.project_id}
                          name={
                            projects.data?.find((p) => p.id === item.project_id)
                              ?.name || "Project"
                          }
                        />
                      ))}
                      {linked.length > 2 && (
                        <span
                          className="team-project-more"
                          title={linked
                            .slice(2)
                            .map(
                              (item) =>
                                projects.data?.find(
                                  (p) => p.id === item.project_id,
                                )?.name,
                            )
                            .filter(Boolean)
                            .join(", ")}
                        >
                          +{linked.length - 2} more
                        </span>
                      )}
                      {!linked.length && (
                        <span className="muted">No projects linked yet</span>
                      )}
                    </div>
                  </div>
                  <div className="team-summary-progress">
                    {tasks.isPending ? (
                      <p className="muted">Loading task progress…</p>
                    ) : tasks.error ? (
                      <ErrorState error={tasks.error} />
                    ) : (
                      <>
                        <div>
                          <span>Tasks completed</span>
                          <strong>
                            {completed} / {work.length}
                          </strong>
                        </div>
                        <div
                          className="team-completion-track"
                          role="progressbar"
                          aria-label={`Completed tasks for ${t.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={percent}
                          aria-valuetext={`${completed} of ${work.length} tasks completed`}
                        >
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        <p className="muted">
                          {work.length - completed} open ·{" "}
                          {
                            work.filter((task) => task.status === "blocked")
                              .length
                          }{" "}
                          blocked
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="team-summary-footer">
                  <span className="muted">
                    {t.updated_at || t.created_at
                      ? `Updated ${dateLabel((t.updated_at || t.created_at).slice(0, 10))}`
                      : "Team workspace"}
                  </span>
                  {superAdmin && (
                    <div className="toolbar">
                      {!t.archived && <AddTeamMemberPopover team={t} />}
                      <Button
                        variant="ghost"
                        aria-label={`Edit ${t.name}`}
                        onClick={manage}
                      >
                        Manage team
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            teams.data?.length ? "No teams match your filters" : "No teams yet"
          }
        >
          {teams.data?.length
            ? "Search by another team or member, or change the visibility filter."
            : "Create a team, then add approved members."}
        </Empty>
      )}
      {editor === "new" && (
        <NameEditor action="team" onClose={() => setEditor(undefined)} />
      )}
      {editor && editor !== "new" && (
        <TeamManagementDrawer
          key={editor.id}
          team={teams.data?.find((t) => t.id === editor.id) || editor}
          onClose={() => {
            setEditor(undefined);
            setMembership(false);
            mutation.reset();
          }}
          onMember={(id = "", isLead = false) =>
            editMembership(editor.id, id, isLead)
          }
        >
          {membership && (
            <section
              id="team-membership-editor"
              className="team-editor-section"
            >
              <h3>{developer ? "Edit membership" : "Add a member"}</h3>
              {membershipForm}
              <Button variant="ghost" onClick={() => setMembership(false)}>
                Cancel membership changes
              </Button>
            </section>
          )}
        </TeamManagementDrawer>
      )}
      <Dialog
        open={membership && !editor}
        onOpenChange={setMembership}
        title="Manage team membership"
        description="Moving a member closes their previous membership today. Existing work records retain their original team."
      >
        {membershipForm}
      </Dialog>
    </div>
  );
}
export function PeoplePage({ approvals = false }: { approvals?: boolean }) {
  const { profile } = useAuth(),
    superAdmin = profile!.role === "super_admin",
    people = useAllRows("profiles");
  const [person, setPerson] = useState<Profile>(),
    [role, setRole] = useState("developer"),
    [status, setStatus] = useState("active");
  const mutation = useCommand();
  const accountForm = useValidatedForm(accountSchema, {
    role: role as "developer" | "admin" | "super_admin",
    status: status as "pending" | "active" | "rejected" | "inactive",
  });
  const shown =
    people.data?.filter((p) => !approvals || p.status === "pending") || [];
  return (
    <>
      <PageHeader
        title={approvals ? "Account approvals" : "People"}
        description={
          approvals
            ? "New accounts stay pending until a Super Admin approves them."
            : "Roles are controlled on the server. Team leads see their authorized members."
        }
      />
      {people.isPending ? (
        <Loading />
      ) : people.error ? (
        <ErrorState error={people.error} />
      ) : (
        <Card className="panel">
          {shown.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="People, scroll for more columns"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    {superAdmin && <TableHead>Manage</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="toolbar">
                          <Avatar
                            name={p.name}
                            src={p.avatar_url || undefined}
                          />
                          <div>
                            <strong>{p.name}</strong>
                            <small>{p.email}</small>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{p.role.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        <Badge value={p.status} />
                      </TableCell>
                      <TableCell>
                        {dateLabel(p.created_at.slice(0, 10))}
                      </TableCell>
                      {superAdmin && (
                        <TableCell>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setPerson(p);
                              setRole(p.role);
                              setStatus(
                                p.status === "pending" ? "active" : p.status,
                              );
                              mutation.reset();
                            }}
                          >
                            Manage account
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty
              title={
                approvals
                  ? "No accounts awaiting approval"
                  : "No members in your scope"
              }
            />
          )}
        </Card>
      )}
      {person && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setPerson(undefined);
          }}
          title={`Manage ${person.name}`}
        >
          <form
            className="form-grid"
            noValidate
            onSubmit={accountForm.handleSubmit(() => {
              mutation.mutate(
                { action: "user", payload: { id: person.id, role, status } },
                { onSuccess: () => setPerson(undefined) },
              );
            })}
          >
            <Field
              label="Role"
              error={accountForm.formState.errors.role?.message}
            >
              <NativeSelect
                value={role}
                {...accountForm.register("role", {
                  onChange: (e) => setRole(e.target.value),
                })}
              >
                {["developer", "admin", "super_admin"].map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Account status"
              error={accountForm.formState.errors.status?.message}
            >
              <NativeSelect
                value={status}
                {...accountForm.register("status", {
                  onChange: (e) => setStatus(e.target.value),
                })}
              >
                {["pending", "active", "rejected", "inactive"].map((s) => (
                  <NativeSelectOption key={s}>{s}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <p className="muted">
              After approval, assign the person to a team from Teams. An Admin
              needs a lead membership to manage that team.
            </p>
            {mutation.error && <ErrorState error={mutation.error} />}
            <Button disabled={mutation.isPending}>Save account</Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function ProjectsPage() {
  const { profile } = useAuth(),
    superAdmin = profile!.role === "super_admin",
    projects = useAllRows("projects"),
    modules = useAllRows("modules"),
    teams = useAllRows("teams"),
    scope = useAllRows("project_memberships"),
    mutation = useCommand();
  const [editor, setEditor] = useState<{
      action: "project" | "module";
      record?: Project | Module;
      project_id?: string;
    }>(),
    [scopeProject, setScopeProject] = useState(""),
    [scopeTeam, setScopeTeam] = useState("");
  const accessForm = useValidatedForm(projectAccessSchema, { team: scopeTeam });
  return (
    <>
      <PageHeader
        title="Projects & modules"
        description="Developers can work across projects. Grant each team access to every project it works on."
        actions={
          superAdmin && (
            <Button onClick={() => setEditor({ action: "project" })}>
              <Plus size={16} />
              Create project
            </Button>
          )
        }
      />
      {mutation.error && <ErrorState error={mutation.error} />}
      {projects.isPending || modules.isPending ? (
        <Loading />
      ) : projects.error || modules.error ? (
        <ErrorState error={projects.error || modules.error} />
      ) : projects.data.length ? (
        <div className="project-list">
          {projects.data.map((p) => (
            <Card className="panel" key={p.id}>
              <div className="panel-heading">
                <h2>{p.name}</h2>
                <div className="toolbar">
                  {p.archived && <Badge value="archived" />}
                  {superAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        aria-label={`Rename ${p.name}`}
                        size="icon"
                        onClick={() =>
                          setEditor({ action: "project", record: p })
                        }
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          mutation.mutate({
                            action: "project",
                            payload: { ...p, archived: !p.archived },
                          })
                        }
                      >
                        {p.archived ? "Restore" : "Archive"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setEditor({ action: "module", project_id: p.id })
                        }
                      >
                        Add module
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="module-list">
                {modules.data
                  ?.filter((m) => m.project_id === p.id)
                  .map((m) => (
                    <div className="list-row" key={m.id}>
                      <span className="grow">{m.name}</span>
                      {m.archived && <Badge value="archived" />}
                      {superAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            aria-label={`Rename module ${m.name}`}
                            size="icon"
                            onClick={() =>
                              setEditor({
                                action: "module",
                                record: m,
                                project_id: p.id,
                              })
                            }
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              mutation.mutate({
                                action: "module",
                                payload: { ...m, archived: !m.archived },
                              })
                            }
                          >
                            {m.archived ? "Restore" : "Archive"}
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
              <div className="padded">
                <h3>Authorized teams</h3>
                <p className="muted">
                  All developers in these teams can create their own tasks in
                  this project.
                </p>
                {scope.data
                  ?.filter((s) => s.project_id === p.id)
                  .map((s) => (
                    <div className="list-row" key={s.id}>
                      <span>
                        {teams.data?.find((t) => t.id === s.team_id)?.name ||
                          "Team"}
                      </span>
                      {superAdmin && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            mutation.mutate({
                              action: "project_membership",
                              payload: {
                                project_id: p.id,
                                team_id: s.team_id,
                                remove: true,
                              },
                            })
                          }
                        >
                          Remove access
                        </Button>
                      )}
                    </div>
                  ))}
                {superAdmin && (
                  <Button variant="ghost" onClick={() => setScopeProject(p.id)}>
                    Grant team access
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No projects yet" />
      )}
      {editor && (
        <NameEditor
          action={editor.action}
          record={editor.record}
          extra={editor.project_id ? { project_id: editor.project_id } : {}}
          onClose={() => setEditor(undefined)}
        />
      )}
      <Dialog
        open={!!scopeProject}
        onOpenChange={(v) => {
          if (!v) setScopeProject("");
        }}
        title="Grant project access"
      >
        <form
          className="form-grid"
          noValidate
          onSubmit={accessForm.handleSubmit(() => {
            mutation.mutate(
              {
                action: "project_membership",
                payload: { project_id: scopeProject, team_id: scopeTeam },
              },
              { onSuccess: () => setScopeProject("") },
            );
          })}
        >
          <Field label="Team" error={accessForm.formState.errors.team?.message}>
            <NativeSelect
              required
              value={scopeTeam}
              {...accessForm.register("team", {
                onChange: (e) => setScopeTeam(e.target.value),
              })}
            >
              <NativeSelectOption value="">Select team</NativeSelectOption>
              {teams.data?.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {mutation.error && <ErrorState error={mutation.error} />}
          <Button disabled={mutation.isPending}>Grant access</Button>
        </form>
      </Dialog>
    </>
  );
}
