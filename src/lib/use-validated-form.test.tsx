import { useState } from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useValidatedForm } from "./use-validated-form";
import { profileSchema } from "./form-schemas";
it("clears corrected controlled-field errors while retaining other errors and blocks invalid saves", async () => {
  const saved = vi.fn();
  function Form() {
    const [name, setName] = useState("");
    const [job, setJob] = useState("");
    const form = useValidatedForm(profileSchema, { name, job });
    return (
      <form noValidate onSubmit={form.handleSubmit(saved)}>
        <input
          aria-label="Name"
          value={name}
          {...form.register("name", {
            onChange: (e) => setName(e.target.value),
          })}
        />
        <input
          aria-label="Job"
          value={job}
          {...form.register("job", { onChange: (e) => setJob(e.target.value) })}
        />
        {form.formState.errors.name && (
          <p>{form.formState.errors.name.message}</p>
        )}
        {form.formState.errors.job && (
          <p>{form.formState.errors.job.message}</p>
        )}
        <button>Save</button>
      </form>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByText("Save"));
  await screen.findByText("Enter a name");
  expect(saved).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Alice" },
  });
  await waitFor(() => expect(screen.queryByText("Enter a name")).toBeNull());
  expect(screen.getByText("Enter a job title")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Job"), {
    target: { value: "Developer" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Enter a job title")).toBeNull(),
  );
  fireEvent.click(screen.getByText("Save"));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(saved.mock.calls[0][0]).toEqual({ name: "Alice", job: "Developer" });
});
