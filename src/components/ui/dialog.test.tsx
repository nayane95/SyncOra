import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Dialog } from "./dialog";
describe("Dialog", () => {
  it("exposes its title, takes focus and closes with Escape", () => {
    const close = vi.fn();
    render(
      <Dialog open onOpenChange={close} title="Assign work">
        <label>
          Task title
          <input autoFocus />
        </label>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Assign work");
    expect(screen.getByRole("textbox")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledWith(false);
  });
});
