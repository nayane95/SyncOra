import { describe, it, expect } from "vitest";
import {
  reconciliationRequests,
  sheetRows,
} from "../../supabase/functions/_shared/reconciliation";
describe("Google Sheets reconciliation", () => {
  it("repeats the same source state without append operations or duplicate rows", () => {
    const tabs = [
        {
          title: "Daily Work Logs",
          headers: ["Source ID", "Hours"],
          records: [
            ["log-1", 8],
            ["log-2", 4],
          ],
        },
      ],
      sheets = [
        {
          properties: {
            title: "Daily Work Logs",
            sheetId: 1,
            gridProperties: { rowCount: 2000, columnCount: 10 },
          },
        },
      ];
    const first = reconciliationRequests(tabs, sheets),
      second = reconciliationRequests(tabs, sheets);
    expect(second).toEqual(first);
    const write = first[1].updateCells!;
    expect(write.range.startRowIndex).toBe(0);
    expect(write.rows).toHaveLength(3);
    expect(write.range.endRowIndex).toBe(2000);
    const correction = reconciliationRequests(
      [{ ...tabs[0], records: [["log-1", 6]] }],
      sheets,
    )[1].updateCells!;
    expect(correction.rows).toHaveLength(2);
    expect(correction.rows[1].values[1].userEnteredValue).toEqual({
      numberValue: 6,
    });
    expect(correction.range.endRowIndex).toBe(2000);
  });
  it("writes all notes as literal text, preventing spreadsheet formula injection", () => {
    expect(
      sheetRows(["Work"], [['=IMPORTXML("x")']])[1].values[0].userEnteredValue,
    ).toEqual({ stringValue: '=IMPORTXML("x")' });
  });
  it("requires managed tabs to exist before reconciliation", () => {
    expect(() =>
      reconciliationRequests(
        [{ title: "Missing", headers: [], records: [] }],
        [],
      ),
    ).toThrow("Missing reporting tab");
  });
});
