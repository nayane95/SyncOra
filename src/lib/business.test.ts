import { describe, it, expect } from "vitest";
import {
  attendanceFor,
  approvedHours,
  carryForward,
  previousWorkday,
  leaveSchema,
  taskSchema,
  whatsapp,
  missingUpdates,
  workingDaysBetween,
  localDate,
  dateLabel,
} from "./business";
import {
  csvCell,
  csvContent,
  makeWorkbook,
  reportRows,
  type ExportData,
} from "./exports";
import type {
  Leave,
  Profile,
  Task,
  WorkLog,
  TaskUpdate,
  Team,
} from "../types/database";
const person = {
  id: "d1",
  name: "Developer One",
  job_title: "Frontend",
  role: "developer",
  status: "active",
} as Profile;
const team = { id: "team", name: "Team 1" } as Team;
const log = {
  id: "l1",
  developer_id: "d1",
  team_id: "team",
  work_date: "2026-10-19",
  hours: 8,
  status: "approved",
  attendance: "working",
  completed_work: "Implemented view",
  remaining_work: "Testing",
  blockers: "",
  unplanned_work: "",
} as WorkLog;
const done = {
  id: "t1",
  task_id: "a",
  work_log_id: "l1",
  title: "Completed view",
  status: "completed",
} as TaskUpdate;
const ongoing = {
  id: "t2",
  task_id: "b",
  work_log_id: "l1",
  title: "Testing view",
  status: "in_progress",
} as TaskUpdate;
const leave = {
  id: "leave",
  developer_id: "d1",
  starts_on: "2026-10-19",
  ends_on: "2026-10-19",
  status: "approved",
  half_day: false,
} as Leave;
const data: ExportData = {
  logs: [log],
  updates: [done, ongoing],
  people: [person],
  teams: [team],
  projects: [],
  modules: [],
  leaves: [],
};
describe("workday and attendance rules", () => {
  it("counts working leave days without iterating through long date ranges", () => {
    expect(
      workingDaysBetween("2026-10-16", "2026-10-20", undefined, ["2026-10-19"]),
    ).toBe(2);
    expect(workingDaysBetween("2026-10-20", "2026-10-19")).toBe(0);
    expect(workingDaysBetween("2026-10-18", "2026-10-18")).toBe(0);
  });
  it("groups late UTC timestamps into the correct Colombo date and tolerates an empty date picker", () => {
    expect(localDate("2026-10-19T20:00:00Z")).toBe("2026-10-20");
    expect(dateLabel("")).toBe("Select a date");
  });
  it("skips weekends and configured holidays", () => {
    expect(previousWorkday("2026-10-20", [1, 2, 3, 4, 5], ["2026-10-19"])).toBe(
      "2026-10-16",
    );
    expect(() => previousWorkday("2026-10-20", [])).toThrow();
  });
  it("full-day leave is zero, half-day is four, pending remains eight", () => {
    expect(attendanceFor("2026-10-19", [leave]).hours).toBe(0);
    expect(
      attendanceFor("2026-10-19", [{ ...leave, half_day: true }]).hours,
    ).toBe(4);
    expect(
      attendanceFor("2026-10-19", [{ ...leave, status: "pending" }]).hours,
    ).toBe(8);
  });
  it("weekends and holidays default to zero without unsafe UTC conversion", () => {
    expect(attendanceFor("2026-10-18", []).attendance).toBe("weekend");
    expect(
      attendanceFor("2026-10-19", [], undefined, ["2026-10-19"]).hours,
    ).toBe(0);
  });
  it("does not flag full-day approved leave or weekends as missing updates", () => {
    expect(missingUpdates([person], [], [leave], "2026-10-19")).toHaveLength(0);
    expect(
      missingUpdates(
        [person],
        [],
        [{ ...leave, status: "pending" }],
        "2026-10-19",
      ),
    ).toHaveLength(1);
    expect(missingUpdates([person], [], [], "2026-10-18")).toHaveLength(0);
  });
  it("validates half-day ranges", () => {
    expect(
      leaveSchema.safeParse({
        leave_type_id: "00000000-0000-4000-8000-000000000001",
        starts_on: "2026-10-19",
        ends_on: "2026-10-20",
        half_day: true,
        reason: "",
      }).success,
    ).toBe(false);
  });
});
describe("tasks, summaries and reporting", () => {
  it("retains the original incomplete task and excludes completed, cancelled and backlog work", () => {
    const tasks = [
      "in_progress",
      "blocked",
      "completed",
      "cancelled",
      "backlog",
      "planned",
    ].map(
      (status, i) =>
        ({
          id: String(i),
          status,
          created_at: "2026-10-16T00:00:00Z",
          assignee_id: "d1",
        }) as Task,
    );
    const carry = carryForward(tasks, "2026-10-19");
    expect(carry.map((t) => t.id)).toEqual(["0", "1", "5"]);
    expect(carry[0]).toBe(tasks[0]);
  });
  it("requires a blocker description", () => {
    expect(
      taskSchema.safeParse({
        title: "Work",
        description: "",
        team_id: "00000000-0000-4000-8000-000000000001",
        project_id: "",
        module_id: "",
        assignee_id: "",
        priority: "medium",
        status: "blocked",
        target_date: "",
        blocker: "",
      }).success,
    ).toBe(false);
  });
  it("counts eight hours once even with multiple tasks and excludes leave and drafts", () => {
    expect(reportRows(data)).toHaveLength(1);
    expect(reportRows(data)[0][5]).toBe(8);
    expect(
      approvedHours([
        log,
        { ...log, id: "2", status: "draft", hours: 9 },
        { ...log, id: "3", attendance: "on_leave", hours: 8 },
      ]),
    ).toBe(8);
  });
  it("uses approved snapshot statuses without fabricating completion", () => {
    const text = whatsapp(
      "2026-10-19",
      "person",
      [log, { ...log, id: "2", status: "submitted", completed_work: "SECRET" }],
      [done, ongoing],
      [person],
      [team],
    );
    expect(text).toContain("*Developer One*");
    expect(text.indexOf("Completed view")).toBeLessThan(
      text.indexOf("In progress"),
    );
    expect(text.indexOf("Testing view")).toBeGreaterThan(
      text.indexOf("In progress"),
    );
    expect(text).not.toContain("SECRET");
    expect(
      whatsapp("2026-10-19", "team", [log], [done, ongoing], [person], [team]),
    ).toContain("Developer One: Testing view");
  });
  it("escapes CSV injection and preserves quoted multiline content", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("hello\nworld")).toBe('"hello\nworld"');
    expect(csvContent(data)).toContain("Hours Invested");
  });
  it("creates a workbook with one daily row, eight hours, frozen header and breakdown", async () => {
    const wb = await makeWorkbook(data, "2026-10-01", "2026-10-31"),
      sheet = wb.getWorksheet("Daily Work Logs")!;
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(2).getCell(6).value).toBe(8);
    expect(sheet.getRow(3).getCell(6).value).toBe(8);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(wb.getWorksheet("Task Breakdown")!.rowCount).toBe(3);
    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
