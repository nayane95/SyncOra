import { dateLabel } from "./business";
import type {
  Profile,
  Team,
  Module,
  Project,
  WorkLog,
  TaskUpdate,
  Leave,
} from "../types/database";
export interface ExportData {
  logs: WorkLog[];
  updates: TaskUpdate[];
  people: Profile[];
  teams: Team[];
  modules: Module[];
  projects: Project[];
  leaves: Leave[];
}
export const reportHeaders = [
  "Date",
  "Developer",
  "Role",
  "Modules",
  "Key Work",
  "Hours Invested",
];
export function reportRows(data: ExportData) {
  return data.logs
    .filter((l) => l.status === "approved")
    .sort(
      (a, b) =>
        a.work_date.localeCompare(b.work_date) ||
        a.developer_id.localeCompare(b.developer_id),
    )
    .map((l) => {
      const person = data.people.find((p) => p.id === l.developer_id),
        tasks = data.updates.filter((u) => u.work_log_id === l.id);
      return [
        l.work_date,
        person?.name || "Team member",
        person?.job_title || "Developer",
        Array.from(
          new Set(
            tasks
              .map(
                (u) =>
                  data.modules.find((m) => m.id === u.module_id)?.name ||
                  data.projects.find((p) => p.id === u.project_id)?.name,
              )
              .filter(Boolean),
          ),
        ).join(", "),
        [
          l.completed_work,
          l.remaining_work ? `Remaining: ${l.remaining_work}` : "",
          l.blockers ? `Blockers: ${l.blockers}` : "",
          l.unplanned_work ? `Additional: ${l.unplanned_work}` : "",
          ...tasks.map((t) => `${t.title} (${t.status.replaceAll("_", " ")})`),
        ]
          .filter(Boolean)
          .join("\n"),
        ["on_leave", "absent"].includes(l.attendance) ? 0 : Number(l.hours),
      ];
    });
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
}
export function csvContent(data: ExportData) {
  return (
    "\uFEFF" +
    [reportHeaders, ...reportRows(data)]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n")
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function makeWorkbook(
  data: ExportData,
  start: string,
  end: string,
) {
  // shortcut: workbooks are assembled in browser memory; use background jobs for large team histories.
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "SyncOra";
  wb.created = new Date();
  const work = wb.addWorksheet("Daily Work Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  work.addRow(reportHeaders);
  work.columns = [
    { width: 16 },
    { width: 24 },
    { width: 20 },
    { width: 30 },
    { width: 80 },
    { width: 18 },
  ];
  let previous = "";
  for (const values of reportRows(data)) {
    const row = work.addRow(values);
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(1).value = new Date(`${values[0]}T00:00:00Z`);
    row.getCell(1).numFmt = "dd-mmm-yyyy";
    row.getCell(6).numFmt = "0.00";
    if (previous !== values[0])
      row.border = { top: { style: "thin", color: { argb: "FF879F99" } } };
    previous = String(values[0]);
  }
  work.autoFilter = { from: "A1", to: `F${Math.max(1, work.rowCount)}` };
  const total = work.addRow([
    "Grand total",
    "",
    "",
    "",
    "",
    reportRows(data).reduce((n, r) => n + Number(r[5]), 0),
  ]);
  total.font = { bold: true };
  const meta = wb.addWorksheet("Report Details");
  meta.addRows([
    ["Reporting period", `${dateLabel(start)} to ${dateLabel(end)}`],
    ["Generated at", new Date().toISOString()],
    ["Source", "Approved daily records. Daily hours counted once."],
    ["Privacy", "Private leave reasons excluded."],
  ]);
  meta.columns = [{ width: 24 }, { width: 85 }];
  const daily = wb.addWorksheet("Daily Summary");
  daily.addRow(["Date", "Approved hours", "Records"]);
  for (const day of [
    ...new Set(
      data.logs.filter((l) => l.status === "approved").map((l) => l.work_date),
    ),
  ].sort()) {
    const r = reportRows({
      ...data,
      logs: data.logs.filter((l) => l.work_date === day),
    });
    daily.addRow([day, r.reduce((n, v) => n + Number(v[5]), 0), r.length]);
  }
  for (const kind of ["Developer", "Team"] as const) {
    const sheet = wb.addWorksheet(`${kind} Summary`);
    sheet.addRow([kind, "Approved hours", "Approved days"]);
    const groups =
      kind === "Developer"
        ? data.people.map((p) => ({ id: p.id, name: p.name }))
        : data.teams;
    for (const group of groups) {
      const logs = data.logs.filter(
        (l) =>
          l.status === "approved" &&
          (kind === "Developer" ? l.developer_id : l.team_id) === group.id,
      );
      if (logs.length)
        sheet.addRow([
          group.name,
          reportRows({ ...data, logs }).reduce((n, v) => n + Number(v[5]), 0),
          logs.filter((l) => Number(l.hours) > 0).length,
        ]);
    }
  }
  const tasks = wb.addWorksheet("Task Breakdown");
  tasks.addRow(["Date", "Developer", "Task ID", "Title", "Status", "Notes"]);
  for (const u of data.updates) {
    const log = data.logs.find(
      (l) => l.id === u.work_log_id && l.status === "approved",
    );
    if (log)
      tasks.addRow([
        log.work_date,
        data.people.find((p) => p.id === log.developer_id)?.name ||
          "Team member",
        u.task_id,
        u.title,
        u.status,
        u.notes,
      ]);
  }
  const leaves = wb.addWorksheet("Leave Summary");
  leaves.addRow(["Developer", "Start", "End", "Half day", "Status"]);
  for (const l of data.leaves)
    leaves.addRow([
      data.people.find((p) => p.id === l.developer_id)?.name || "Team member",
      l.starts_on,
      l.ends_on,
      l.half_day ? "Yes" : "No",
      l.status,
    ]);
  wb.eachSheet((sheet) => {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17675C" },
    };
    sheet.getRow(1).height = 26;
    if (sheet !== work) {
      sheet.columns.forEach((c) => {
        c.width = 30;
      });
      sheet.eachRow((r) => {
        r.alignment = { wrapText: true, vertical: "top" };
      });
    }
  });
  return wb;
}
export async function exportReport(
  data: ExportData,
  start: string,
  end: string,
  type: "xlsx" | "csv",
) {
  if (type === "csv") {
    download(
      new Blob([csvContent(data)], { type: "text/csv;charset=utf-8" }),
      `SyncOra-${start}-${end}.csv`,
    );
    return;
  }
  const wb = await makeWorkbook(data, start, end);
  const bytes = await wb.xlsx.writeBuffer();
  download(
    new Blob([bytes as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `SyncOra-${start}-${end}.xlsx`,
  );
}
