import type { EngineBundle } from "../engine/run.js";
import type { ExportKind } from "../models/enums.js";
import type { ProjectDoc } from "../models/project.js";

export function buildReportPdf(
  kind: ExportKind,
  bundle: EngineBundle,
  record: ProjectDoc,
  options: { watermark?: boolean } = {},
): Buffer {
  const title = titleFor(kind);
  const lines = [
    options.watermark ? "TakeOff Studio Starter – evaluation copy" : "",
    title,
    String(record.name ?? ""),
    `Project reference: ${record.reference ?? "–"}`,
    `Currency: ${String(record.currency ?? "")}`,
    "",
    ...bodyFor(kind, bundle, record),
    "",
    "Open the Excel export for formulas and full schedules.",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");
  return writePdf(lines);
}

function titleFor(kind: ExportKind): string {
  switch (kind) {
    case "BOM_PDF":
      return "Bill of materials";
    case "RATE_PDF":
      return "Rate analysis";
    case "BBS_PDF":
      return "Bar bending schedule";
    case "DIMS_PDF":
      return "Dimension sheet";
    default:
      return "Bills of quantities";
  }
}

function bodyFor(kind: ExportKind, bundle: EngineBundle, record: ProjectDoc): string[] {
  if (kind === "BOM_PDF") {
    return [
      `Materials total: ${round(bundle.bomAmount)}`,
      ...bundle.bom
        .filter((row): row is Extract<typeof row, { code: string }> => "code" in row)
        .slice(0, 24)
        .map((row) => `${row.material}  ${round(row.order)} ${row.unit}  ${round(row.amount)}`),
    ];
  }
  if (kind === "RATE_PDF") {
    return bundle.boq.items.slice(0, 24).map((row) => `${row.item}  ${row.desc}  ${round(row.rate)}`);
  }
  if (kind === "BBS_PDF") {
    return [
      `Steel: ${round(bundle.result.steelKg)} kg`,
      ...bundle.result.bars.slice(0, 30).map((bar) => `${bar.loc}  ${bar.mark}  ${bar.dia} mm  ${round(bar.kg)} kg`),
    ];
  }
  if (kind === "DIMS_PDF") {
    return bundle.result.items.slice(0, 30).map((item) => `${item.loc}  ${item.code}  ${round(item.q)}`);
  }
  return [
    `Subtotal: ${round(bundle.boq.subtotal)}`,
    `Contingency ${record.contingencyRate ?? 0}%: ${round(bundle.boq.contingency)}`,
    `${record.taxName || "Tax"} ${record.taxRate ?? 0}%: ${round(bundle.boq.tax)}`,
    `Total: ${round(bundle.boq.total)}`,
    ...bundle.boq.bills.map((bill) => `${bill.title}: ${round(bill.amount)} (${bill.itemCount} items)`),
  ];
}

function writePdf(lines: string[]): Buffer {
  const commands = ["BT", "/F1 11 Tf", "50 760 Td", "14 TL"];
  for (const line of lines) {
    commands.push(`(${escapePdf(line)}) Tj`, "T*");
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = 9;
  const offsets = [0];
  const chunks = ["%PDF-1.4\n"];
  for (const object of objects) {
    offsets.push(offset);
    chunks.push(`${object}\n`);
    offset += Buffer.byteLength(`${object}\n`);
  }
  const xref = offset;
  const xrefRows = offsets.map((value, index) =>
    index === 0 ? "0000000000 65535 f \n" : `${String(value).padStart(10, "0")} 00000 n \n`,
  );
  chunks.push(`xref\n0 ${objects.length + 1}\n`, ...xrefRows);
  chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[()]/g, "\\$&").slice(0, 110);
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
