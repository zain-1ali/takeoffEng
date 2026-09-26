const RANK = {
  VIEWER: 0,
  COMMENTER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
} as const;

export function canEdit(role: string | null | undefined): boolean {
  return (RANK[role as keyof typeof RANK] ?? 0) >= RANK.EDITOR;
}

export function canComment(role: string | null | undefined): boolean {
  return (RANK[role as keyof typeof RANK] ?? 0) >= RANK.COMMENTER;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function ago(value: string | Date | undefined): string {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  return new Date(value).toLocaleDateString();
}

export function viewLabel(view: string): string {
  const labels: Record<string, string> = {
    project: "Project & type",
    rates: "Rate analysis",
    resources: "Databank",
    boq: "Bills of quantities",
    team: "Team workspace",
    summary: "Dashboard",
  };
  return labels[view] || view || "the project";
}
