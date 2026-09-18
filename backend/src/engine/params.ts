import { n } from "@takeoff/engine";
import type { ComputeResult } from "@takeoff/engine";

const TYPE_LABEL: Record<string, string> = {
  foundation: "Foundations only",
  single: "Single storey",
  multi: "Multi-storey",
  road: "Road",
  bridge: "Concrete bridge",
};

function fmt(value: number, digits: number): string {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function num(value: unknown): number {
  return n(value as number);
}

export function projectParams(
  state: Record<string, unknown>,
  result: ComputeResult,
  extras: {
    currency: string;
    measurementBasis?: string | null;
    contract?: string | null;
    startDate?: string | null;
    duration?: string | null;
    userParams?: { label?: string; value?: string }[];
  },
): [string, string][] {
  const btype = String(state.btype ?? "");
  const basis =
    extras.measurementBasis ||
    (btype === "road" || btype === "bridge"
      ? "CESMM4 principles"
      : "NRM2");
  const params: [string, string][] = [
    ["Project type", TYPE_LABEL[btype] ?? btype],
    ["Measurement basis", basis],
    ["Currency", extras.currency],
  ];

  const levels = Array.isArray(state.levels) ? state.levels : [];
  const placements = (state.pl ?? {}) as Record<string, unknown[]>;
  const types = (state.types ?? {}) as Record<string, { id: string; cw?: unknown }[]>;

  if (btype === "foundation" || btype === "single" || btype === "multi") {
    const active = btype === "multi" ? levels : btype === "single" ? levels.slice(0, 1) : [];
    if (active.length) {
      params.push(["Storeys", String(active.length)]);
      const height = active.reduce((sum, level) => sum + num((level as { h?: unknown }).h), 0);
      params.push(["Height to roof", `${fmt(height, 2)} m`]);
    }
    if (result.floorArea) params.push(["Floor and slab area", `${fmt(result.floorArea, 0)} m²`]);
  } else if (btype === "road") {
    const sections = (placements.rpave ?? []) as { from?: unknown; to?: unknown; type?: string }[];
    const length = sections.reduce((sum, row) => sum + Math.abs(num(row.to) - num(row.from)), 0);
    params.push(["Road length", `${fmt(length / 1000, 3)} km`]);
    const widths = [
      ...new Set(
        sections
          .map((row) => types.rpave?.find((type) => type.id === row.type))
          .filter((type): type is { id: string; cw?: unknown } => Boolean(type))
          .map((type) => fmt(num(type.cw), 1)),
      ),
    ];
    if (widths.length) params.push(["Carriageway width", `${widths.join(" / ")} m`]);
    params.push(["Road sections", String(sections.length)]);
  } else if (btype === "bridge") {
    const deck = (placements.bslab ?? []).find((row) => (row as { part?: string }).part === "Deck slab") as
      | { L?: unknown; W?: unknown }
      | undefined;
    if (deck) {
      params.push(["Bridge length", `${fmt(num(deck.L), 1)} m`]);
      params.push(["Deck width", `${fmt(num(deck.W), 2)} m`]);
    }
    const spans = (placements.bbeam ?? []).filter((row) => (row as { part?: string }).part === "Girder") as {
      span?: unknown;
    }[];
    if (spans.length) {
      params.push(["Spans", `${spans.length} (${spans.map((span) => fmt(num(span.span), 0)).join(" + ")} m)`]);
    }
  }

  params.push(["Concrete", `${fmt(result.concrete, 1)} m³`]);
  if (result.steelKg) params.push(["Reinforcement", `${fmt(result.steelKg / 1000, 2)} t`]);
  if (result.formwork) params.push(["Formwork", `${fmt(result.formwork, 0)} m²`]);
  if (extras.contract) params.push(["Form of contract", extras.contract]);
  if (extras.startDate) params.push(["Start date", extras.startDate]);
  if (extras.duration) params.push(["Duration", extras.duration]);
  for (const extra of extras.userParams ?? []) {
    if (extra.label || extra.value) params.push([extra.label ?? "", extra.value ?? ""]);
  }
  return params;
}
