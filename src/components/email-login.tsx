import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { emailLoginSchema } from "../lib/form-schemas";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field } from "./shared";

export function EmailLogin({ disabled = false }: { disabled?: boolean }) {
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <form
      className="grid w-full gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setError("");
        try {
          const { error } = await supabase!.auth.signInWithPassword(values);
          if (error) throw error;
          form.resetField("password");
        } catch {
          setError(
            "Unable to sign in. Check your email and password and try again.",
          );
        }
      })}
    >
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>Or sign in with email</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input
          className="h-12"
          placeholder="you@company.com"
          spellCheck={false}
          autoCapitalize="none"
          type="email"
          autoComplete="username"
          {...form.register("email")}
        />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <Input
          className="h-12"
          placeholder="Enter your password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
      </Field>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button
        className="h-12 w-full"
        type="submit"
        variant="outline"
        disabled={disabled || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Signing in…" : "Sign in with email"}
      </Button>
    </form>
  );
}
