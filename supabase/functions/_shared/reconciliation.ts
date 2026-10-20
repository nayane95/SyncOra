export interface ReportingTab {
  title: string;
  headers: string[];
  records: unknown[][];
}
export interface SheetProperties {
  sheetId: number;
  title: string;
  gridProperties?: { rowCount: number; columnCount: number };
}
export function sheetRows(headers: string[], records: unknown[][]) {
  return [headers, ...records].map((row) => ({
    values: row.map((value) => ({
      userEnteredValue:
        typeof value === "number"
          ? { numberValue: value }
          : { stringValue: String(value ?? "") },
    })),
  }));
}
export function reconciliationRequests(
  tabs: ReportingTab[],
  sheets: { properties: SheetProperties }[],
) {
  return tabs.flatMap((tab) => {
    const properties = sheets.find(
      (s) => s.properties.title === tab.title,
    )?.properties;
    if (!properties) throw new Error(`Missing reporting tab: ${tab.title}`);
    const rows = Math.max(
        1000,
        tab.records.length + 1,
        properties.gridProperties?.rowCount || 0,
      ),
      columns = Math.max(
        tab.headers.length,
        properties.gridProperties?.columnCount || 0,
      );
    return [
      {
        updateSheetProperties: {
          properties: {
            sheetId: properties.sheetId,
            gridProperties: {
              rowCount: rows,
              columnCount: columns,
              frozenRowCount: 1,
            },
          },
          fields: "gridProperties",
        },
      },
      {
        updateCells: {
          range: {
            sheetId: properties.sheetId,
            startRowIndex: 0,
            endRowIndex: rows,
            startColumnIndex: 0,
            endColumnIndex: tab.headers.length,
          },
          rows: sheetRows(tab.headers, tab.records),
          fields: "userEnteredValue",
        },
      },
    ];
  });
}
