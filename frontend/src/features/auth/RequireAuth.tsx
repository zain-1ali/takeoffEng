import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.js";
import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.ready) {
    return <p className="mx-auto max-w-xl px-6 py-16 text-muted">Loading workspace…</p>;
  }
  if (!auth.user || !auth.token) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
