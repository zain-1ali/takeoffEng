export function formatNumber(
  value: number,
  digits = 2,
  locale = "en-GB",
): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formulaDigits(value: number): number {
  return Math.abs(value) < 10 && value % 1 !== 0 ? 3 : 2;
}

export function roundResult(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const sec = Math.round((now - then) / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}
