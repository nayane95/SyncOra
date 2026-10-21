import { useState } from "react";
import { Controller } from "react-hook-form";
import { UserPlus, X } from "lucide-react";
import { useAllRows, useCommand } from "../lib/api";
import { today } from "../lib/business";
import { membershipSchema } from "../lib/form-schemas";
import { useValidatedForm } from "../lib/use-validated-form";
import { Button } from "../components/ui/button";
import { PersonPicker } from "../components/ui/person-picker";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
} from "../components/ui/popover";
import { Field, ErrorState } from "../components/shared";
import type { Team } from "../types/database";

export function AddTeamMemberPopover({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [developer, setDeveloper] = useState("");
  const people = useAllRows("profiles"),
    memberships = useAllRows("team_memberships"),
    teams = useAllRows("teams");
  const mutation = useCommand();
  const form = useValidatedForm(membershipSchema, {
    developer,
    team: team.id,
    lead: false,
  });
  const current =
    memberships.data?.filter(
      (m) => m.starts_on <= today() && (!m.ends_on || m.ends_on > today()),
    ) || [];
  const previous = current.find(
    (m) => m.developer_id === developer && m.team_id !== team.id,
  );
  const available =
    people.data?.filter(
      (p) =>
        p.status === "active" &&
        !current.some((m) => m.developer_id === p.id && m.team_id === team.id),
    ) || [];
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDeveloper("");
          form.clearErrors();
          mutation.reset();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="secondary" disabled={team.archived}>
          <UserPlus size={16} />
          Add member
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="team-member-popover"
        aria-label="Add team member"
      >
        <div className="team-member-popover-heading">
          <div>
            <h3>Add team member</h3>
            <p className="muted">{team.name}</p>
          </div>
          <PopoverClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close add member">
              <X size={16} />
            </Button>
          </PopoverClose>
        </div>
        <form
          className="form-grid"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(
              {
                action: "membership",
                payload: {
                  developer_id: values.developer,
                  team_id: team.id,
                  is_lead: false,
                },
              },
              { onSuccess: () => setOpen(false) },
            ),
          )}
        >
          <Controller
            control={form.control}
            name="developer"
            render={({ field }) => (
              <Field
                label="Team member"
                error={form.formState.errors.developer?.message}
              >
                <PersonPicker
                  people={available}
                  value={field.value}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  disabled={
                    mutation.isPending ||
                    people.isPending ||
                    memberships.isPending
                  }
                  required
                  onChange={(id) => {
                    field.onChange(id);
                    setDeveloper(id);
                  }}
                />
              </Field>
            )}
          />
          {previous ? (
            <p className="muted">
              This moves the member from{" "}
              {teams.data?.find((t) => t.id === previous.team_id)?.name ||
                "their current team"}
              . Previous work keeps its original team.
            </p>
          ) : (
            <p className="muted">
              New members join with the Member role. Edit membership to assign a
              team lead.
            </p>
          )}
          {!people.isPending && !memberships.isPending && !available.length && (
            <p className="muted">All active people are already in this team.</p>
          )}
          {(people.error ||
            memberships.error ||
            teams.error ||
            mutation.error) && (
            <ErrorState
              error={
                people.error ||
                memberships.error ||
                teams.error ||
                mutation.error
              }
            />
          )}
          <div className="dialog-actions">
            <PopoverClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </PopoverClose>
            <Button
              disabled={
                mutation.isPending ||
                people.isPending ||
                memberships.isPending ||
                !!people.error ||
                !!memberships.error ||
                !available.length
              }
            >
              Add to team
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
