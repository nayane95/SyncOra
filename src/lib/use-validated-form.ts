import { useEffect } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

export function useValidatedForm<T extends FieldValues>(
  schema: z.ZodType<T, T>,
  values: T,
  mode: "onSubmit" | "onChange" = "onSubmit",
) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    values,
    mode,
    resetOptions: { keepErrors: true, keepIsSubmitted: true },
  });
  const { isSubmitted, errors } = form.formState;
  const hasErrors = Object.keys(errors).length > 0;
  const signature = JSON.stringify(values);
  const { trigger } = form;
  // Controlled values reset RHF state; recheck errors after the new values arrive.
  useEffect(() => {
    if (isSubmitted || hasErrors) void trigger();
  }, [signature, isSubmitted, hasErrors, trigger]);
  return form;
}
