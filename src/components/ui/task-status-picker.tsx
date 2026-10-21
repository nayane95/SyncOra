import Select from "react-select";
import { Check } from "lucide-react";
import { label, statuses } from "../../lib/business";
import type { TaskStatus } from "../../types/database";

const descriptions: Record<TaskStatus, string> = {
  backlog: "Keep for later",
  planned: "Ready to start",
  in_progress: "Working on this now",
  blocked: "Needs help to move forward",
  completed: "Work is finished",
  cancelled: "No longer needed",
};

export function TaskStatusPicker({
  value,
  onChange,
  disabled,
  developer,
  taskNumber,
}: {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  disabled?: boolean;
  developer: boolean;
  taskNumber: number;
}) {
  const options = statuses
    .filter(
      (status) =>
        !developer ||
        ["planned", "in_progress", "blocked", "completed", value].includes(
          status,
        ),
    )
    .map((status) => ({ value: status, label: label(status) }));
  return (
    <div
      className="app-select-wrapper task-status-picker"
      data-slot="native-select-wrapper"
    >
      <Select
        aria-label={`Status for SYNC-${taskNumber}`}
        value={options.find((option) => option.value === value)}
        options={options}
        onChange={(option) => option && onChange(option.value)}
        isDisabled={disabled}
        isSearchable={false}
        unstyled
        className="app-select"
        classNamePrefix="app-select"
        menuPlacement="auto"
        maxMenuHeight={280}
        menuShouldScrollIntoView
        formatOptionLabel={(option, { context }) => (
          <span className="task-status-choice">
            <span
              className={`badge badge-${option.value}`}
              data-select-value={option.value}
            >
              {option.label}
            </span>
            {context === "menu" && (
              <>
                <small>{descriptions[option.value]}</small>
                {option.value === value && (
                  <Check size={16} aria-hidden="true" />
                )}
              </>
            )}
          </span>
        )}
      />
    </div>
  );
}
