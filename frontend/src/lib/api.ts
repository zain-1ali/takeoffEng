export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly extras: Record<string, unknown>;

  constructor(
    status: number,
    type: string,
    detail: string,
    extras: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.type = type;
    this.extras = extras;
  }
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  orgId?: string | null;
  ifMatch?: string | number;
  headers?: Record<string, string>;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.orgId) headers.set("X-Org-Id", options.orgId);
  if (options.ifMatch != null) headers.set("If-Match", `"${options.ifMatch}"`);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) headers.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Could not reach the API. Check that the backend is running.",
    );
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const { type, detail, title, status, message, ...extras } = data;
    throw new ApiError(
      response.status,
      String(type ?? "error"),
      String(detail ?? title ?? message ?? `Request failed (${response.status})`),
      extras,
    );
  }
  return data as T;
}
