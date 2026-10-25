import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EmailLogin } from "./email-login";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: signIn } },
}));

it("validates inline, submits credentials, and displays a generic failure without exposing account details", async () => {
  render(<EmailLogin />);
  fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));
  await screen.findByText("Enter a valid email address");
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "super-admin@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "local-test-password" },
  });
  signIn.mockResolvedValueOnce({
    error: new Error("Internal account details"),
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));
  await screen.findByText(/Unable to sign in/);
  expect(
    screen.queryByText("Internal account details"),
  ).not.toBeInTheDocument();
  expect(signIn).toHaveBeenCalledWith({
    email: "super-admin@example.com",
    password: "local-test-password",
  });
  signIn.mockResolvedValueOnce({ error: null });
  fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Password")).toHaveValue(""),
  );
});
