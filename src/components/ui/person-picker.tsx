import { useImperativeHandle, useRef, type ComponentProps } from "react";
import Select, { type SelectInstance } from "react-select";
import type { Profile } from "../../types/database";
import { Avatar } from "../shared";
import { label } from "../../lib/business";

type PersonOption = { value: string; label: string; person: Profile };
export function PersonPicker({
  people,
  value,
  onChange,
  onBlur,
  ref,
  id,
  name,
  disabled,
  required,
  ...aria
}: {
  people: Profile[];
  value: string;
  onChange: (id: string) => void;
  onBlur?: () => void;
  ref?: React.Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
} & Pick<
  ComponentProps<"input">,
  "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"
>) {
  const select = useRef<SelectInstance<PersonOption>>(null);
  useImperativeHandle(ref, () => select.current!.inputRef!);
  const options = people.map((person) => ({
    value: person.id,
    label: `${person.name} ${person.email} ${label(person.role)}`,
    person,
  }));
  return (
    <div
      className="app-select-wrapper person-picker"
      data-slot="native-select-wrapper"
    >
      <Select<PersonOption>
        ref={select}
        inputId={id}
        name={name}
        {...aria}
        aria-required={required}
        options={options}
        value={options.find((option) => option.value === value) || null}
        onChange={(option) => onChange(option?.value || "")}
        onBlur={onBlur}
        isDisabled={disabled}
        isClearable
        unstyled
        className="app-select"
        classNamePrefix="app-select"
        menuPlacement="auto"
        maxMenuHeight={280}
        menuShouldScrollIntoView
        placeholder="Search people…"
        noOptionsMessage={() => "No matching people"}
        formatOptionLabel={({ value, person }, { context }) => (
          <span className="person-picker-option" data-select-value={value}>
            <Avatar name={person.name} src={person.avatar_url || undefined} />
            <span className="person-picker-identity">
              <strong>{person.name}</strong>
              {context === "menu" && <small>{person.email}</small>}
            </span>
            <span className="person-picker-role">{label(person.role)}</span>
          </span>
        )}
      />
    </div>
  );
}
