import { today } from "./business";
import { z } from "zod";
export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(120, "Use 120 characters or fewer"),
});
const optionalId = z.union([z.literal(""), z.uuid("Select a valid option")]);
export const membershipSchema = z.object({
  developer: z.uuid("Select a team member"),
  team: optionalId,
  lead: z.boolean(),
});
export const accountSchema = z.object({
  role: z.enum(["developer", "admin", "super_admin"]),
  status: z.enum(["pending", "active", "rejected", "inactive"]),
});
export const projectAccessSchema = z.object({ team: z.uuid("Select a team") });
export const profileSchema = nameSchema.extend({
  job: z
    .string()
    .trim()
    .min(1, "Enter a job title")
    .max(120, "Use 120 characters or fewer"),
});
export const calendarSchema = z.object({
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Select at least one working day"),
  domains: z
    .string()
    .refine(
      (value) =>
        !value.trim() ||
        value
          .split(",")
          .every((d) =>
            /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(d.trim()),
          ),
      "Enter valid domains separated by commas, such as example.com",
    ),
});
export const holidaySchema = nameSchema.extend({
  date: z.iso.date("Select a valid date"),
});
export const integrationSchema = z
  .object({
    sheet: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]*$/, "Enter the spreadsheet ID, not its URL"),
    enabled: z.boolean(),
  })
  .refine((v) => !v.enabled || !!v.sheet, {
    path: ["sheet"],
    message: "Enter a spreadsheet ID to enable synchronization",
  });
export const contributorSchema = z.object({
  developer: z.uuid("Select a contributor"),
});
export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Enter a comment")
    .max(4000, "Use 4,000 characters or fewer"),
});
export const decisionSchema = z.object({
  note: z.string().max(4000, "Use 4,000 characters or fewer"),
});
export const meetingSchema = z.object({
  date: z.iso.date("Select a valid meeting date"),
  team: z.uuid("Select a meeting team"),
  notes: z.string().max(10000, "Use 10,000 characters or fewer"),
});
export const summarySchema = z
  .object({
    date: z.iso.date("Select a valid summary date"),
    body: z
      .string()
      .trim()
      .min(1, "Enter a summary message")
      .max(100000, "Use 100,000 characters or fewer"),
  })
  .refine((v) => v.date <= today(), {
    path: ["date"],
    message: "Choose a summary date up to today",
  });
