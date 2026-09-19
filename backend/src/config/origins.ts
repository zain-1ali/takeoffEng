import { env } from "./env.js";

export function allowedOrigins(): string[] {
  const settings = env();
  return [settings.CLIENT_URL, settings.WEB_URL]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (env().NODE_ENV !== "production") return true;
  const normalized = origin.replace(/\/$/, "");
  return allowedOrigins().includes(normalized);
}
