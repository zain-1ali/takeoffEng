import { problem } from "../common/problem.js";
import { env } from "../config/env.js";

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export function googleEnabled(): boolean {
  return Boolean(env().GOOGLE_CLIENT_ID);
}

export function googleClientId(): string {
  return env().GOOGLE_CLIENT_ID;
}

export async function googleProfileFromIdToken(idToken: string): Promise<GoogleProfile> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  const payload = (await response.json().catch(() => ({}))) as {
    aud?: string;
    iss?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    exp?: string;
  };
  if (!response.ok) {
    throw problem(401, "google_failed", "Unauthorized", "Could not verify the Google sign-in.");
  }
  const clientId = env().GOOGLE_CLIENT_ID;
  const issuerOk = payload.iss === "accounts.google.com" || payload.iss === "https://accounts.google.com";
  const verified = payload.email_verified === true || payload.email_verified === "true";
  const expired = Number(payload.exp ?? 0) * 1000 <= Date.now();
  if (!issuerOk || payload.aud !== clientId || !payload.sub || !payload.email || !verified || expired) {
    throw problem(401, "google_unverified", "Unauthorized", "Google did not return a verified email address.");
  }
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || payload.email.split("@")[0] || "Google user",
  };
}

export function defaultOrgName(name: string, email: string): string {
  const base = name.trim() || email.split("@")[0] || "My";
  return `${base}'s workspace`.slice(0, 80);
}
