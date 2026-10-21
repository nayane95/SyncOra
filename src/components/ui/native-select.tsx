import * as React from "react";
import Select, { type SelectInstance, type GroupBase } from "react-select";
import { statuses } from "../../lib/business";
import { cn } from "../../lib/utils";

type Option = { value: string; label: string; isDisabled?: boolean };
function optionsFrom(
  children: React.ReactNode,
): (Option | GroupBase<Option>)[] {
  return React.Children.toArray(children).flatMap(
    (child): (Option | GroupBase<Option>)[] => {
      if (
        !React.isValidElement<{
          value?: string | number;
          children?: React.ReactNode;
          disabled?: boolean;
          label?: string;
        }>(child)
      )
        return [];
      if (child.type === React.Fragment)
        return optionsFrom(child.props.children);
      if (child.type === NativeSelectOptGroup)
        return [
          {
            label: child.props.label,
            options: optionsFrom(child.props.children) as Option[],
          },
        ];
      const label = React.Children.toArray(child.props.children).join("");
      return [
        {
          value: String(child.props.value ?? label),
          label,
          isDisabled: child.props.disabled,
        },
      ];
    },
  );
}

function NativeSelect({
  className,
  size = "default",
  children,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  id,
  name,
  ref,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  const select = React.useRef<SelectInstance<Option>>(null);
  const [localValue, setLocalValue] = React.useState(
    String(defaultValue ?? ""),
  );
  const options = optionsFrom(children);
  const flat = options.flatMap((option) =>
    "options" in option ? option.options : [option],
  );
  const current = String(value ?? localValue);
  const statusOptions =
    flat.some((option) => option.value !== "") &&
    flat.every(
      (option) =>
        !option.value || statuses.some((status) => status === option.value),
    );
  // Existing RHF registrations need a focusable input and select-shaped change events.
  React.useImperativeHandle(
    ref,
    () => select.current?.inputRef as unknown as HTMLSelectElement,
  );
  const event = (next: string) =>
    ({
      target: { value: next, name },
      currentTarget: { value: next, name },
    }) as React.ChangeEvent<HTMLSelectElement>;
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn("app-select-wrapper", className)}
      data-size={size}
    >
      <Select<Option>
        ref={select}
        inputId={id}
        name={name}
        value={flat.find((option) => option.value === current) ?? null}
        options={options}
        isDisabled={disabled}
        isSearchable
        unstyled
        className="app-select"
        classNamePrefix="app-select"
        menuPosition="absolute"
        maxMenuHeight={240}
        menuPlacement="auto"
        menuShouldScrollIntoView
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        aria-required={props.required}
        placeholder="Select…"
        noOptionsMessage={() => "No matching options"}
        formatOptionLabel={(option) => (
          <span
            data-select-value={option.value}
            className={
              statusOptions && option.value
                ? `badge badge-${option.value}`
                : undefined
            }
          >
            {option.label}
          </span>
        )}
        onChange={(option) => {
          const next = option?.value ?? "";
          setLocalValue(next);
          onChange?.(event(next));
        }}
        onBlur={() =>
          onBlur?.(event(current) as React.FocusEvent<HTMLSelectElement>)
        }
      />
    </div>
  );
}
function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option {...props} />;
}
function NativeSelectOptGroup(props: React.ComponentProps<"optgroup">) {
  return <optgroup {...props} />;
}
export { NativeSelect, NativeSelectOption, NativeSelectOptGroup };
