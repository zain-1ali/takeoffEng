export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export type DocMap = Record<string, unknown>;

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current == null || typeof current !== "object") return undefined;
    return (current as DocMap)[key];
  }, obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const next = structuredClone(obj);
  const keys = path.split(".");
  let cursor: DocMap = next as DocMap;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    const child = cursor[key];
    if (child == null || typeof child !== "object") cursor[key] = {};
    cursor = cursor[key] as DocMap;
  }
  cursor[keys.at(-1)!] = value;
  return next;
}

export function asRecord(value: unknown): DocMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DocMap : {};
}

export function asList<T = DocMap>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function stringOf(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}
