import type { CatalogueEntry, ComputeResult } from "../types.js";
import { raRate } from "./pricing.js";
import type {
  BoqBill,
  BoqItemRow,
  BoqRow,
  BoqTotals,
  PricingContext,
} from "./pricing-types.js";

function itemLetter(index: number): string {
  let value = index + 1;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + value % 26) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

export interface BoqOptions {
  manualRates?: Readonly<Record<string, number>>;
}

export function boqRows(
  result: ComputeResult,
  entries: readonly CatalogueEntry[],
  pricing: PricingContext,
  options: BoqOptions = {},
): BoqRow[] {
  const rows: BoqRow[] = [];
  const seen = new Set<string>();
  let itemIndex = 0;
  let lastSection = "";
  for (const entry of entries) {
    if (seen.has(entry.code)) continue;
    seen.add(entry.code);
    let quantity = result.tot[entry.code] ?? 0;
    if (Math.abs(quantity) < .0005) continue;
    if (entry.unit === "t") quantity /= 1000;
    if (entry.sec !== lastSection) {
      rows.push({ sec: entry.sec });
      lastSection = entry.sec;
    }
    const roundedQuantity = entry.unit === "t"
      ? Math.round(quantity * 1000) / 1000
      : Math.round(quantity * 100) / 100;
    const manualRate = options.manualRates?.[entry.code];
    const rate = manualRate ?? raRate(entry.code, pricing);
    rows.push({
      item: itemLetter(itemIndex++),
      code: entry.code,
      desc: entry.desc,
      unit: entry.unit,
      quantity: roundedQuantity,
      rate,
      manualRate,
      amount: rate ? roundedQuantity * rate : 0,
    });
  }
  return rows;
}

export interface TotalsOptions extends BoqOptions {
  contingencyPct?: number;
  taxPct?: number;
}

export function boqTotals(
  result: ComputeResult,
  entries: readonly CatalogueEntry[],
  pricing: PricingContext,
  options: TotalsOptions = {},
): BoqTotals {
  const rows = boqRows(result, entries, pricing, options);
  const bills: BoqBill[] = [];
  for (const row of rows) {
    if ("sec" in row) {
      bills.push({ title: row.sec, amount: 0, itemCount: 0 });
    } else {
      const bill = bills.at(-1);
      if (!bill) continue;
      bill.amount += row.amount;
      bill.itemCount += 1;
    }
  }
  const items = rows.filter((row): row is BoqItemRow => "code" in row);
  const subtotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const contingency = subtotal * (options.contingencyPct ?? 5) / 100;
  const tax = (subtotal + contingency) * (options.taxPct ?? 18) / 100;
  return {
    rows,
    items,
    bills,
    subtotal,
    contingency,
    tax,
    total: subtotal + contingency + tax,
  };
}
