import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import type { ReactNode } from "react";

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const auth = useAuth();
  const planLabel = auth.plan === "STARTER" ? "Starter" : auth.plan;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="abar">
        <Link to="/app" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
        <div className="meta">
          <div>{title}</div>
          <small>{subtitle ?? (auth.orgName ? `${auth.orgName} · ${planLabel}` : planLabel)}</small>
        </div>
        <span className="planpill">Plan: <b>{planLabel}</b></span>
        {actions}
        <button className="btn" type="button" onClick={() => void auth.logout()}>
          Sign out
        </button>
      </header>
      {children}
    </div>
  );
}
