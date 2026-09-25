import ExcelJS from "exceljs";
import {
  DIAMETERS,
  analyse,
  isExpr,
  n,
  type ComputeResult,
  type FullProject,
  type PricingContext,
} from "@takeoff/engine";
import type { EngineBundle } from "../engine/run.js";
import type { ProjectDoc } from "../models/project.js";

const TYPE_LABEL: Record<string, string> = {
  foundation: "Foundations only",
  single: "Single storey",
  multi: "Multi-storey",
  road: "Road",
  bridge: "Concrete bridge",
};

const INT_UNITS = new Set(["No.", "bags", "sheets", "rolls"]);

export async function buildWorkbook(
  bundle: EngineBundle,
  record: ProjectDoc,
  options: { watermark?: boolean } = {},
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "TakeOff Studio";
  book.created = new Date();
  const mark = Boolean(options.watermark);
  const state = bundle.project as unknown as FullProject & Record<string, unknown>;
  const project = asRecord(state.project);
  const currency = String(record.currency || project.currency || "USD");
  const name = String(record.name || project.name || "Take-off");

  addProjectSheet(book, bundle, record, mark);
  addInputsSheet(book, state, bundle.result, mark);
  addRoofingSheet(book, state, mark);
  addBarSheet(book, bundle.result, mark);
  addDimSheet(book, bundle, mark);
  addBoqSheet(book, bundle, record, currency, name, mark);
  addSummarySheet(book, bundle, record, currency, name, mark);
  addBomSheet(book, bundle, currency, name, mark);
  addSteelSheet(book, bundle.result, mark);
  addResourcesSheet(book, bundle.pricing, mark);
  addRatesSheet(book, bundle, mark);

  const buffer = await book.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function addProjectSheet(book: ExcelJS.Workbook, bundle: EngineBundle, record: ProjectDoc, watermark: boolean): void {
  const sheet = book.addWorksheet("Project");
  const state = bundle.project as unknown as Record<string, unknown>;
  const project = asRecord(state.project);
  const rules = asRecord(state.rules);
  const levels = Array.isArray(state.levels) ? (state.levels as Record<string, unknown>[]) : [];
  const stakeholders = Array.isArray(record.stakeholders)
    ? (record.stakeholders as { role?: string; org?: string; contact?: string }[])
    : [];
  banner(sheet, watermark);
  sheet.columns = [{ width: 40 }, { width: 30 }, { width: 16 }];
  const rows: unknown[][] = [
    ["Structural works take-off"],
    [],
    ["Project", record.name],
    ["Location", record.location ?? project.location ?? ""],
    ["Client", project.client ?? ""],
    ["Drawings", record.drawings ?? project.drawing ?? ""],
    ["Taken off by", project.by ?? ""],
    ["Date", project.date ?? ""],
    ["Currency", record.currency],
    ["Project reference", record.reference ?? project.ref ?? ""],
    ["Revision", record.revision ?? project.rev ?? ""],
    ["Stage", record.stage],
    ["Measurement basis", record.measurementBasis ?? ""],
    ["Form of contract", record.contract ?? ""],
    ["Description", record.description ?? project.desc ?? ""],
    [],
    ["STAKEHOLDERS"],
    ...stakeholders.filter((row) => row.org || row.contact).map((row) => [row.role, row.org, row.contact]),
    [],
    ["PROJECT PARAMETERS"],
    ...bundle.params,
    ["Building type", TYPE_LABEL[String(state.btype)] ?? String(state.btype)],
    [],
    ["Covers (mm): footings / columns / beams / slabs / walls", `${num(rules.cF)} / ${num(rules.cC)} / ${num(rules.cB)} / ${num(rules.cS)} / ${num(rules.cW)}`],
    ["Anchorage (× dia): footings / beams / slabs", `${num(rules.anchF)} / ${num(rules.anchB)} / ${num(rules.anchS)}`],
    ["Lap (× dia)", num(rules.lap)],
    ["Link hooks (× dia)", num(rules.hook)],
    ["Stock length (m)", num(rules.stock)],
    ["Working space (m)", rules.wsOn ? num(rules.ws) : 0],
    ["Blinding (mm)", num(rules.blinding)],
    [],
    ["Levels", "Floor to floor (m)", "Slab zone (m)"],
    ...levels.map((level) => [String(level.name ?? ""), num(level.h), num(level.zone)]),
  ];
  writeRows(sheet, rows);
}

function addInputsSheet(book: ExcelJS.Workbook, state: Record<string, unknown>, result: ComputeResult, watermark: boolean): void {
  const sheet = book.addWorksheet("Inputs");
  banner(sheet, watermark);
  const types = asRecord(state.types);
  const placements = asRecord(state.pl);
  const rows: unknown[][] = [["Member types and placements"]];
  for (const [kind, list] of Object.entries(types)) {
    if (!Array.isArray(list) || !list.length) continue;
    rows.push([]);
    rows.push([String(kind).toUpperCase()]);
    const keys = Object.keys(asRecord(list[0])).filter((key) => key !== "id");
    rows.push(keys);
    for (const item of list as Record<string, unknown>[]) {
      rows.push(keys.map((key) => cellValue(item[key])));
    }
  }
  rows.push([]);
  rows.push(["PLACEMENTS"]);
  for (const [kind, list] of Object.entries(placements)) {
    if (!Array.isArray(list) || !list.length) continue;
    rows.push([]);
    rows.push([String(kind).toUpperCase()]);
    const keys = Object.keys(asRecord(list[0])).filter((key) => key !== "id");
    rows.push([...keys, "Concrete (m³)", "Steel (kg)"]);
    for (const item of list as Record<string, unknown>[]) {
      const stats = result.byPlacement[String(item.id ?? "")] ?? { conc: 0, kg: 0 };
      rows.push([...keys.map((key) => cellValue(item[key])), round(stats.conc, 3), round(stats.kg, 1)]);
    }
  }
  writeRows(sheet, rows, true);
}

function addRoofingSheet(book: ExcelJS.Workbook, state: Record<string, unknown>, watermark: boolean): void {
  const sheet = book.addWorksheet("Roofing");
  banner(sheet, watermark);
  const types = asList(asRecord(state.types).roof);
  const placements = asList(asRecord(state.pl).roof);
  const roofx = asRecord(state.roofx);
  const rows: unknown[][] = [
    ["Roofing", String(state.roofMode ?? "simple")],
    [],
    ["TYPES"],
  ];
    if (types[0]) {
    const keys = Object.keys(types[0]).filter((key) => key !== "id");
    rows.push(keys);
    for (const item of types) rows.push(keys.map((key) => cellValue(item[key])));
  }
  rows.push([]);
  rows.push(["SIMPLE PLACEMENTS"]);
  if (placements[0]) {
    const keys = Object.keys(placements[0]).filter((key) => key !== "id");
    rows.push(keys);
    for (const item of placements) rows.push(keys.map((key) => cellValue(item[key])));
  }
  for (const group of ["planes", "lines", "openings", "trusses"] as const) {
    const list = asList(roofx[group]);
    rows.push([]);
    rows.push([group.toUpperCase()]);
    if (list[0]) {
      const keys = Object.keys(list[0]).filter((key) => key !== "id");
      rows.push(keys);
      for (const item of list) rows.push(keys.map((key) => cellValue(item[key])));
    }
  }
  writeRows(sheet, rows, true);
}

function addBarSheet(book: ExcelJS.Workbook, result: ComputeResult, watermark: boolean): void {
  const sheet = book.addWorksheet("Bar Schedule");
  banner(sheet, watermark);
  sheet.columns = [46, 10, 24, 8, 10, 10, 10, 12, 12, 8, 12].map((width) => ({ width }));
  const header = ["Location", "Bar mark", "Shape", "Dia (mm)", "No. of members", "Bars in each", "Total bars", "Length each (m)", "Total length (m)", "kg/m", "Weight (kg)"];
  writeRows(sheet, [header]);
  result.bars.forEach((bar, index) => {
    const row = index + 2 + (watermark ? 1 : 0);
    const excel = sheet.addRow([
      bar.loc,
      bar.mark,
      bar.shape,
      bar.dia,
      bar.members,
      bar.each,
      bar.members * bar.each,
      round(bar.len, 3),
      round(bar.total, 3),
      round(bar.dia * bar.dia / 162.2, 4),
      round(bar.kg, 2),
    ]);
    formula(excel.getCell(7), `E${row}*F${row}`, bar.members * bar.each);
    formula(excel.getCell(9), `G${row}*H${row}`, bar.total);
    formula(excel.getCell(10), `D${row}^2/162.2`, bar.dia * bar.dia / 162.2);
    formula(excel.getCell(11), `ROUND(I${row}*J${row},2)`, bar.kg);
  });
  const last = sheet.rowCount;
  const total = sheet.addRow(["", "Total", "", "", "", "", "", "", "", "", result.steelKg]);
  if (last > 1) formula(total.getCell(11), `SUM(K2:K${last})`, result.steelKg);
}

function addDimSheet(book: ExcelJS.Workbook, bundle: EngineBundle, watermark: boolean): void {
  const sheet = book.addWorksheet("Dim Sheet");
  banner(sheet, watermark);
  sheet.columns = [8, 10, 10, 10, 12, 6, 80, 12].map((width) => ({ width }));
  writeRows(sheet, [["Times", "Dim 1", "Dim 2", "Dim 3", "Squaring", "Unit", "Description", "Code"]]);
  const catalogue = new Map(bundle.boq.items.map((row) => [row.code, row]));
  let last = "";
  for (const item of bundle.result.items) {
    if (item.loc !== last) {
      sheet.addRow([]);
      sheet.addRow([item.loc]);
      last = item.loc;
    }
    const row = sheet.rowCount + 1;
    const entry = catalogue.get(item.code);
    const added = sheet.addRow([
      round(item.times, 4),
      item.d1,
      item.d2,
      item.d3,
      round(item.q, 4),
      entry?.unit === "t" ? "kg" : entry?.unit ?? "",
      entry?.desc ?? item.code,
      item.code,
    ]);
    formula(
      added.getCell(5),
      `A${row}*IF(B${row}="",1,B${row})*IF(C${row}="",1,C${row})*IF(D${row}="",1,D${row})`,
      item.q,
    );
  }
}

function addBoqSheet(
  book: ExcelJS.Workbook,
  bundle: EngineBundle,
  record: ProjectDoc,
  currency: string,
  name: string,
  watermark: boolean,
): void {
  const sheet = book.addWorksheet("BOQ");
  banner(sheet, watermark);
  sheet.columns = [6, 82, 12, 6, 12, 16].map((width) => ({ width }));
  writeRows(sheet, [
    [name],
    [`Bills of quantities – ${TYPE_LABEL[String((bundle.project as { btype?: string }).btype)] ?? ""}`],
    [],
    ["Item", "Description", "Quantity", "Unit", `Rate (${currency})`, `Amount (${currency})`],
  ]);
  const sums: string[] = [];
  let start = 0;
  let section = "";
  const close = () => {
    if (!start) return;
    const row = sheet.rowCount + 1;
    const added = sheet.addRow(["", `Total – ${section}`, "", "", "", 0]);
    formula(added.getCell(6), `SUM(F${start}:F${row - 1})`, 0);
    sums.push(`F${row}`);
    start = 0;
  };
  for (const row of bundle.boq.rows) {
    if ("sec" in row) {
      close();
      section = row.sec;
      sheet.addRow([]);
      sheet.addRow(["", row.sec]);
      start = sheet.rowCount + 1;
      continue;
    }
    const excelRow = sheet.rowCount + 1;
    const divide = row.unit === "t" ? "/1000" : "";
    const digits = row.unit === "t" ? 3 : 2;
    const added = sheet.addRow([row.item, row.desc, row.quantity, row.unit, row.rate || "", row.amount]);
    formula(
      added.getCell(3),
      `ROUND(SUMIF('Dim Sheet'!$H:$H,"${row.code}",'Dim Sheet'!$E:$E)${divide},${digits})`,
      row.quantity,
    );
    formula(added.getCell(6), `IF(E${excelRow}="",0,C${excelRow}*E${excelRow})`, row.amount);
    if (row.manualRate != null) added.getCell(5).note = "Manual rate used in BOQ";
  }
  close();
  sheet.addRow([]);
  const subRow = sheet.rowCount + 1;
  const sub = sheet.addRow(["", "Subtotal", "", "", "", bundle.boq.subtotal]);
  formula(sub.getCell(6), sums.join("+") || "0", bundle.boq.subtotal);
  const cont = sheet.addRow(["", "Contingency", "", "%", record.contingencyRate ?? 0, bundle.boq.contingency]);
  formula(cont.getCell(6), `F${subRow}*E${subRow + 1}/100`, bundle.boq.contingency);
  const tax = sheet.addRow(["", record.taxName || "Tax", "", "%", record.taxRate ?? 0, bundle.boq.tax]);
  formula(tax.getCell(6), `(F${subRow}+F${subRow + 1})*E${subRow + 2}/100`, bundle.boq.tax);
  const total = sheet.addRow(["", "Total", "", "", "", bundle.boq.total]);
  formula(total.getCell(6), `F${subRow}+F${subRow + 1}+F${subRow + 2}`, bundle.boq.total);
}

function addSummarySheet(
  book: ExcelJS.Workbook,
  bundle: EngineBundle,
  record: ProjectDoc,
  currency: string,
  name: string,
  watermark: boolean,
): void {
  const sheet = book.addWorksheet("Summary");
  banner(sheet, watermark);
  sheet.columns = [6, 60, 8, 18, 10].map((width) => ({ width }));
  writeRows(sheet, [
    [name],
    ["Summary of bills"],
    [],
    ["Bill", "Description", "Items", `Amount (${currency})`, "Share"],
    ...bundle.boq.bills.map((bill, index) => [
      index + 1,
      bill.title,
      bill.itemCount,
      round(bill.amount, 2),
      bundle.boq.subtotal ? `${round((bill.amount / bundle.boq.subtotal) * 100, 1)}%` : "",
    ]),
    [],
    ["", "Subtotal", "", round(bundle.boq.subtotal, 2)],
    ["", `Contingency ${record.contingencyRate ?? 0}%`, "", round(bundle.boq.contingency, 2)],
    ["", `${record.taxName || "Tax"} ${record.taxRate ?? 0}%`, "", round(bundle.boq.tax, 2)],
    ["", "Total", "", round(bundle.boq.total, 2)],
  ]);
}

function addBomSheet(book: ExcelJS.Workbook, bundle: EngineBundle, currency: string, name: string, watermark: boolean): void {
  const sheet = book.addWorksheet("Bill of Materials");
  banner(sheet, watermark);
  sheet.columns = [34, 46, 8, 12, 8, 14, 14, 16].map((width) => ({ width }));
  writeRows(sheet, [
    [name],
    ["Bill of materials"],
    [],
    ["Material", "Specification", "Unit", "Net quantity", "Waste %", "Order quantity", `Unit price (${currency})`, `Amount (${currency})`],
  ]);
  const sums: string[] = [];
  let start = 0;
  const close = () => {
    if (!start) return;
    const row = sheet.rowCount + 1;
    const added = sheet.addRow(["Section total", "", "", "", "", "", "", 0]);
    formula(added.getCell(8), `SUM(H${start}:H${row - 1})`, 0);
    sums.push(`H${row}`);
    start = 0;
  };
  for (const row of bundle.bom) {
    if ("sec" in row) {
      close();
      sheet.addRow([]);
      sheet.addRow([row.sec]);
      start = sheet.rowCount + 1;
      continue;
    }
    const excelRow = sheet.rowCount + 1;
    const added = sheet.addRow([
      row.material,
      row.specification,
      row.unit,
      round(row.net, 3),
      row.waste,
      row.order,
      row.rate || "",
      row.amount,
    ]);
    formula(
      added.getCell(6),
      INT_UNITS.has(row.unit) ? `ROUNDUP(D${excelRow}*(1+E${excelRow}/100),0)` : `D${excelRow}*(1+E${excelRow}/100)`,
      row.order,
    );
    formula(added.getCell(8), `IF(G${excelRow}="",0,F${excelRow}*G${excelRow})`, row.amount);
  }
  close();
  const total = sheet.addRow(["Total materials", "", "", "", "", "", "", bundle.bomAmount]);
  formula(total.getCell(8), sums.join("+") || "0", bundle.bomAmount);
}

function addSteelSheet(book: ExcelJS.Workbook, result: ComputeResult, watermark: boolean): void {
  const sheet = book.addWorksheet("Steel by Diameter");
  banner(sheet, watermark);
  const used = DIAMETERS.filter((diameter) => result.bars.some((bar) => bar.dia === diameter));
  const elements = [...new Set(result.bars.map((bar) => bar.el))];
  sheet.columns = [{ width: 16 }, ...used.map(() => ({ width: 12 })), { width: 14 }];
  writeRows(sheet, [
    ["Element", ...used.map((diameter) => `${diameter} mm (kg)`), "Total (kg)"],
    ...elements.map((element) => [
      element,
      ...used.map((diameter) =>
        round(result.bars.filter((bar) => bar.el === element && bar.dia === diameter).reduce((sum, bar) => sum + bar.kg, 0), 1),
      ),
      round(result.bars.filter((bar) => bar.el === element).reduce((sum, bar) => sum + bar.kg, 0), 1),
    ]),
    [
      "Total",
      ...used.map((diameter) =>
        round(result.bars.filter((bar) => bar.dia === diameter).reduce((sum, bar) => sum + bar.kg, 0), 1),
      ),
      round(result.steelKg, 1),
    ],
  ]);
}

function addResourcesSheet(book: ExcelJS.Workbook, pricing: PricingContext, watermark: boolean): void {
  const sheet = book.addWorksheet("Resources");
  banner(sheet, watermark);
  sheet.columns = [8, 12, 48, 8, 12, 30].map((width) => ({ width }));
  const market = String((pricing.project as { ra?: { market?: string } }).ra?.market ?? "Resource databank");
  writeRows(sheet, [
    [market],
    [],
    ["Code", "Category", "Resource", "Unit", `Rate (${pricing.databankCurrency})`, "Notes"],
    ...pricing.resources.map((row) => [row.code, row.category, row.name, row.unit, row.rate, row.note ?? ""]),
  ]);
}

function addRatesSheet(book: ExcelJS.Workbook, bundle: EngineBundle, watermark: boolean): void {
  const sheet = book.addWorksheet("Rate Analysis");
  banner(sheet, watermark);
  sheet.columns = [6, 56, 8, 10, 10, 12, 22].map((width) => ({ width }));
  const tools = bundle.pricing.toolsPct ?? 0;
  const oh = bundle.pricing.overheadPct ?? 0;
  const profit = bundle.pricing.profitPct ?? 0;
  writeRows(sheet, [["Rate analysis", `Small tools ${tools}% of labour · overheads ${oh}% · profit ${profit}%`], []]);
  for (const row of bundle.boq.rows) {
    if ("sec" in row) {
      sheet.addRow([row.sec]);
      continue;
    }
    const analysis = analyse(row.code, bundle.pricing);
    sheet.addRow([row.item, row.desc, row.unit, "", "", "", ""]);
    sheet.addRow(["", "Resource", "Unit", "Qty", "Rate", "Cost", "Category"]);
    const start = sheet.rowCount + 1;
    for (const line of analysis.rows) {
      const excelRow = sheet.rowCount + 1;
      const added = sheet.addRow([
        "",
        `${line.resourceCode} ${line.resource?.name ?? "missing"}`,
        line.resource?.unit ?? "",
        line.quantity,
        line.resource?.rate ?? 0,
        line.cost,
        line.resource?.category ?? "",
      ]);
      formula(added.getCell(6), `D${excelRow}*E${excelRow}`, line.cost);
    }
    const end = sheet.rowCount;
    const lab = `SUMIF(G${start}:G${end},"Labour",F${start}:F${end})`;
    const direct = sheet.addRow(["", "Direct cost incl. small tools", "", "", "", analysis.direct, ""]);
    formula(direct.getCell(6), `SUM(F${start}:F${end})+${lab}*${tools}/100`, analysis.direct);
    const overhead = sheet.addRow(["", "Overheads", "", "", oh, analysis.overheads, "%"]);
    formula(overhead.getCell(6), `F${sheet.rowCount - 1}*E${sheet.rowCount}/100`, analysis.overheads);
    const profitRow = sheet.addRow(["", "Profit", "", "", profit, analysis.profit, "%"]);
    formula(profitRow.getCell(6), `(F${sheet.rowCount - 2}+F${sheet.rowCount - 1})*E${sheet.rowCount}/100`, analysis.profit);
    const rate = sheet.addRow(["", `Rate per ${row.unit}`, "", "", "", analysis.rate, row.manualRate != null ? "Manual rate used in BOQ" : ""]);
    formula(rate.getCell(6), `ROUND(F${sheet.rowCount - 3}+F${sheet.rowCount - 2}+F${sheet.rowCount - 1},2)`, analysis.rate);
    sheet.addRow([]);
  }
}

function banner(sheet: ExcelJS.Worksheet, watermark: boolean): void {
  if (!watermark) return;
  const row = sheet.addRow(["TakeOff Studio Starter – evaluation copy"]);
  row.font = { bold: true, color: { argb: "FF8A4B08" } };
}

function writeRows(sheet: ExcelJS.Worksheet, rows: unknown[][], noteFormulas = false): void {
  for (const values of rows) {
    const notes: { index: number; text: string }[] = [];
    const cells = values.map((value, index) => {
      if (noteFormulas && typeof value === "object" && value && "value" in value) {
        const packed = value as { value: unknown; note?: string };
        if (packed.note) notes.push({ index, text: packed.note });
        return packed.value;
      }
      return value;
    });
    const row = sheet.addRow(cells);
    for (const note of notes) row.getCell(note.index + 1).note = note.text;
  }
}

function formula(cell: ExcelJS.Cell, formulaText: string, result: number): void {
  cell.value = { formula: formulaText, result };
}

function cellValue(value: unknown): unknown {
  if (value == null || value === "") return "";
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string" && isExpr(value)) {
    return { value: n(value), note: `Entered as ${value}` };
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : [];
}

function num(value: unknown): number {
  return n(value as number);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
