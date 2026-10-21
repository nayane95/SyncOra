import { expect, it } from "vitest";
import {
  nameSchema,
  membershipSchema,
  profileSchema,
  calendarSchema,
  holidaySchema,
  integrationSchema,
  commentSchema,
  summarySchema,
} from "./form-schemas";
import { taskSchema, leaveSchema, rangeSchema } from "./business";
it("rejects whitespace and enforces text limits", () => {
  expect(nameSchema.safeParse({ name: "   " }).success).toBe(false);
  expect(nameSchema.parse({ name: "  Team  " }).name).toBe("Team");
  expect(profileSchema.safeParse({ name: "Alice", job: " " }).success).toBe(
    false,
  );
  expect(commentSchema.safeParse({ body: " " }).success).toBe(false);
  expect(commentSchema.safeParse({ body: "a".repeat(4001) }).success).toBe(
    false,
  );
  expect(
    summarySchema.safeParse({ date: "2026-10-20", body: "" }).success,
  ).toBe(false);
});
it("validates membership selection without preventing explicit removal", () => {
  const member = {
    developer: "00000000-0000-4000-8000-000000000001",
    team: "",
    lead: false,
  };
  expect(membershipSchema.safeParse(member).success).toBe(true);
  expect(membershipSchema.safeParse({ ...member, developer: "" }).success).toBe(
    false,
  );
});
it("validates calendar, holiday and integration settings", () => {
  expect(calendarSchema.safeParse({ days: [], domains: "" }).success).toBe(
    false,
  );
  expect(
    calendarSchema.safeParse({
      days: [1],
      domains: "example.com, sub.example.org",
    }).success,
  ).toBe(true);
  expect(
    calendarSchema.safeParse({ days: [1], domains: "https://example.com" })
      .success,
  ).toBe(false);
  expect(
    holidaySchema.safeParse({ name: "Holiday", date: "2026-02-30" }).success,
  ).toBe(false);
  expect(
    integrationSchema.safeParse({ enabled: true, sheet: "" }).success,
  ).toBe(false);
  expect(
    integrationSchema.safeParse({ enabled: false, sheet: "" }).success,
  ).toBe(true);
  expect(
    integrationSchema.safeParse({
      enabled: true,
      sheet: "https://docs.google.com/sheet",
    }).success,
  ).toBe(false);
});
it("attaches date errors to their fields and validates optional task dates", () => {
  expect(
    rangeSchema.safeParse({ start: "2026-10-20", end: "2026-10-19" }).error
      ?.issues[0].path,
  ).toEqual(["end"]);
  expect(
    leaveSchema.safeParse({
      leave_type_id: "00000000-0000-4000-8000-000000000001",
      starts_on: "2026-10-20",
      ends_on: "2026-10-21",
      half_day: true,
      reason: "",
    }).error?.issues[0].path,
  ).toEqual(["ends_on"]);
  expect(
    taskSchema.safeParse({
      title: "Task",
      team_id: "00000000-0000-4000-8000-000000000001",
      project_id: "",
      module_id: "",
      assignee_id: "",
      priority: "medium",
      status: "planned",
      description: "",
      blocker: "",
      target_date: "2026-02-30",
    }).error?.issues[0].path,
  ).toEqual(["target_date"]);
});
