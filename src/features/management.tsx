import { useState } from "react";
import { Plus, Archive, Pencil, UserPlus } from "lucide-react";
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
} from "../components/shared";
function NameEditor({
  action,
  record,
  extra = {},
  onClose,
}: {
  action: "team" | "project" | "module" | "leave_type";
  record?: Team | Project | Module;
  extra?: object;
  onClose: () => void;
}) {
  const [name, setName] = useState(record?.name || ""),
    mutation = useCommand();
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`${record ? "Rename" : "Create"} ${action.replaceAll("_", " ")}`}
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(
            {
              action,
              payload: {
                id: record?.id,
                name,
                archived: record?.archived || false,
                ...extra,
              },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <Field label="Name">
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending || !name.trim()}>
            Save {action.replaceAll("_", " ")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function TeamsPage() {
  const { profile } = useAuth(),
    superAdmin = profile!.role === "super_admin";
  const teams = useAllRows("teams"),
    people = useAllRows("profiles"),
    members = useAllRows("team_memberships");
  const [editor, setEditor] = useState<Team | "new">(),
    [membership, setMembership] = useState(false),
    [developer, setDeveloper] = useState(""),
    [team, setTeam] = useState(""),
    [lead, setLead] = useState(false),
    mutation = useCommand();
  const current =
    members.data?.filter(
      (m) => m.starts_on <= today() && (!m.ends_on || m.ends_on > today()),
    ) || [];
  return (
    <>
      <PageHeader
        title="Teams"
        description="Shared ownership today, accurate membership history tomorrow."
        actions={
          superAdmin && (
            <>
              <Button variant="secondary" onClick={() => setMembership(true)}>
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
      {mutation.error && <ErrorState error={mutation.error} />}
      {teams.isPending || members.isPending ? (
        <Loading />
      ) : teams.error || members.error ? (
        <ErrorState error={teams.error || members.error} />
      ) : teams.data.length ? (
        <div className="team-grid">
          {teams.data.map((t) => (
            <section className="panel" key={t.id}>
              <div className="panel-heading">
                <h2>{t.name}</h2>
                <div className="toolbar">
                  {t.archived && <Badge value="archived" />}
                  {superAdmin && (
                    <>
                      <Button
                        aria-label={`Rename ${t.name}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditor(t)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        aria-label={`${t.archived ? "Restore" : "Archive"} ${t.name}`}
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          mutation.mutate({
                            action: "team",
                            payload: { ...t, archived: !t.archived },
                          })
                        }
                      >
                        <Archive size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {current.filter((m) => m.team_id === t.id).length ? (
                current
                  .filter((m) => m.team_id === t.id)
                  .map((m) => (
                    <div className="list-row" key={m.id}>
                      <Avatar
                        name={
                          people.data?.find((p) => p.id === m.developer_id)
                            ?.name || "Team member"
                        }
                      />
                      <div className="grow">
                        <strong>
                          {people.data?.find((p) => p.id === m.developer_id)
                            ?.name || "Team member"}
                        </strong>
                        <p className="muted">
                          {m.is_lead ? "Team lead" : "Member"} · since{" "}
                          {dateLabel(m.starts_on)}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <Empty title="No active members" />
              )}
              <details className="padded">
                <summary>Membership history</summary>
                {members.data
                  ?.filter((m) => m.team_id === t.id)
                  .map((m) => (
                    <p key={m.id} className="muted">
                      {people.data?.find((p) => p.id === m.developer_id)
                        ?.name || "Team member"}{" "}
                      · {dateLabel(m.starts_on)} to{" "}
                      {m.ends_on ? dateLabel(m.ends_on) : "present"}
                    </p>
                  ))}
              </details>
            </section>
          ))}
        </div>
      ) : (
        <Empty title="No teams yet">
          Create a team, then add approved members.
        </Empty>
      )}
      {editor && (
        <NameEditor
          action="team"
          record={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
        />
      )}
      <Dialog
        open={membership}
        onOpenChange={setMembership}
        title="Manage team membership"
        description="Moving a member closes their previous membership today. Existing work records retain their original team."
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
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
          }}
        >
          <Field label="Team member">
            <select
              required
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
            >
              <option value="">Select member</option>
              {people.data
                ?.filter((p) => p.status === "active")
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Team">
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Remove from current team</option>
              {teams.data
                ?.filter((t) => !t.archived)
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={lead}
              onChange={(e) => setLead(e.target.checked)}
            />
            Team lead (requires Admin role)
          </label>
          {mutation.error && <ErrorState error={mutation.error} />}
          <Button disabled={mutation.isPending}>Save membership</Button>
        </form>
      </Dialog>
    </>
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
        <section className="panel">
          {shown.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    {superAdmin && <th>Manage</th>}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="toolbar">
                          <Avatar name={p.name} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>{p.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{p.role.replaceAll("_", " ")}</td>
                      <td>
                        <Badge value={p.status} />
                      </td>
                      <td>{dateLabel(p.created_at.slice(0, 10))}</td>
                      {superAdmin && (
                        <td>
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
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
        </section>
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
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(
                { action: "user", payload: { id: person.id, role, status } },
                { onSuccess: () => setPerson(undefined) },
              );
            }}
          >
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {["developer", "admin", "super_admin"].map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["pending", "active", "rejected", "inactive"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
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
  return (
    <>
      <PageHeader
        title="Projects & modules"
        description="Reusable project context for tasks and historical reports."
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
            <section className="panel" key={p.id}>
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
            </section>
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
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              {
                action: "project_membership",
                payload: { project_id: scopeProject, team_id: scopeTeam },
              },
              { onSuccess: () => setScopeProject("") },
            );
          }}
        >
          <Field label="Team">
            <select
              required
              value={scopeTeam}
              onChange={(e) => setScopeTeam(e.target.value)}
            >
              <option value="">Select team</option>
              {teams.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {mutation.error && <ErrorState error={mutation.error} />}
          <Button disabled={mutation.isPending}>Grant access</Button>
        </form>
      </Dialog>
    </>
  );
}
