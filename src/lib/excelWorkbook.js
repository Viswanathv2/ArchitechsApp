const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellValueToString(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text || "").join("").trim();
    if (value.text !== undefined) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();
  }
  return String(value).trim();
}

export async function exportExcelWorkbook({ fileName, sheetName, columns, rows }) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 22
  }));
  worksheet.addRows(rows);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF25324A" }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importExcelRows(file, columnKeys, requiredKeys = []) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook does not contain a worksheet.");

  const headerColumns = new Map();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizeHeader(cellValueToString(cell));
    if (header) headerColumns.set(header, columnNumber);
  });

  const missingHeaders = requiredKeys.filter((key) => !headerColumns.has(normalizeHeader(key)));
  if (missingHeaders.length) {
    throw new Error(`Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.map((key) => key.replace(/_/g, " ")).join(", ")}.`);
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = {};
    for (const key of columnKeys) {
      const columnNumber = headerColumns.get(normalizeHeader(key));
      values[key] = columnNumber ? cellValueToString(row.getCell(columnNumber)) : "";
    }
    if (Object.values(values).some((value) => value !== "")) rows.push(values);
  });
  return rows;
}
