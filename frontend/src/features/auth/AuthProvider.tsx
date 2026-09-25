import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../../lib/api.js";
import { getStoredOrgId, getStoredToken, setStoredOrgId, setStoredToken } from "../../lib/session.js";
import type { MeResponse, PublicUser } from "../../lib/types.js";

interface AuthState {
  ready: boolean;
  user: PublicUser | null;
  orgId: string | null;
  orgName: string | null;
  role: string | null;
  plan: string;
  entitlements: MeResponse["entitlements"] | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  setSession: (token: string, orgId?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST: AuthState = {
  ready: true,
  user: null,
  orgId: null,
  orgName: null,
  role: null,
  plan: "STARTER",
  entitlements: null,
  token: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...GUEST, ready: false });

  const loadMe = useCallback(async (token: string, orgId: string | null) => {
    const me = await api<MeResponse>("/v1/me", { token, orgId });
    const nextOrg = me.org?.id ?? orgId;
    setStoredToken(token);
    setStoredOrgId(nextOrg);
    setState({
      ready: true,
      user: me.user,
      orgId: nextOrg,
      orgName: me.org?.name ?? null,
      role: me.role,
      plan: me.plan,
      entitlements: me.entitlements,
      token,
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = getStoredToken();
      const orgId = getStoredOrgId();
      if (stored) {
        try {
          await loadMe(stored, orgId);
          return;
        } catch {
          /* try refresh */
        }
      }
      try {
        const refreshed = await api<{ accessToken: string }>("/v1/auth/refresh", { method: "POST" });
        await loadMe(refreshed.accessToken, orgId);
      } catch {
        setStoredToken(null);
        setState({ ...GUEST, ready: true });
      }
    })();
  }, [loadMe]);

  const setSession = useCallback(async (token: string, orgId?: string | null) => {
    await loadMe(token, orgId ?? getStoredOrgId());
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      if (state.token) await api("/v1/auth/logout", { method: "POST", token: state.token });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    setStoredToken(null);
    setStoredOrgId(null);
    setState({ ...GUEST, ready: true });
  }, [state.token]);

  const refreshMe = useCallback(async () => {
    if (!state.token) return;
    await loadMe(state.token, state.orgId);
  }, [loadMe, state.orgId, state.token]);

  const value = useMemo(
    () => ({ ...state, setSession, logout, refreshMe }),
    [state, setSession, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
