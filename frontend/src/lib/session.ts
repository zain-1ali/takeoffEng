const TOKEN_KEY = "takeoff.accessToken";
const ORG_KEY = "takeoff.orgId";
const SIGNUP_KEY = "takeoff.signup";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredOrgId(): string | null {
  return localStorage.getItem(ORG_KEY);
}

export function setStoredOrgId(orgId: string | null): void {
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
  else localStorage.removeItem(ORG_KEY);
}

export interface SignupDraft {
  name?: string;
  orgName?: string;
  type?: string;
}

export function getSignupDraft(): SignupDraft | null {
  const raw = sessionStorage.getItem(SIGNUP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignupDraft;
  } catch {
    return null;
  }
}

export function setSignupDraft(draft: SignupDraft | null): void {
  if (draft) sessionStorage.setItem(SIGNUP_KEY, JSON.stringify(draft));
  else sessionStorage.removeItem(SIGNUP_KEY);
}
