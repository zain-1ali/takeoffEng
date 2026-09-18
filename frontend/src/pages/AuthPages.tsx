import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.js";
import { api, ApiError } from "../lib/api.js";
import { getSignupDraft, setSignupDraft } from "../lib/session.js";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ verifyUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.ready && auth.user) navigate(next, { replace: true });
  }, [auth.ready, auth.user, navigate, next]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ sent: boolean; devVerifyUrl?: string }>("/v1/auth/magic-link", {
        body: { email },
      });
      setSent({ verifyUrl: result.devVerifyUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1>Sign in</h1>
      <p>We’ll email you a magic link. No password to remember.</p>
      {error ? <p className="alert">{error}</p> : null}
      {sent ? (
        <p className="alert ok">
          Check {email} for a sign-in link.
          {sent.verifyUrl ? (
            <>
              {" "}
              <Link to={pathFromUrl(sent.verifyUrl)}>Open the development link</Link>
            </>
          ) : null}
        </p>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          <EmailField value={email} onChange={setEmail} />
          <button className="btn primary full" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-muted">
        New here? <Link to="/signup">Create a workspace</Link>
      </p>
    </AuthShell>
  );
}

export function SignupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [sent, setSent] = useState<{ verifyUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const type = params.get("type") ?? undefined;
  const plan = params.get("plan");

  useEffect(() => {
    if (auth.ready && auth.user) navigate("/app", { replace: true });
  }, [auth.ready, auth.user, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSignupDraft({ name, orgName, type });
      const result = await api<{ sent: boolean; devVerifyUrl?: string }>("/v1/auth/magic-link", {
        body: { email, name },
      });
      setSent({ verifyUrl: result.devVerifyUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a sign-up link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1>Start a free take-off</h1>
      <p>Create a workspace for your practice. You can invite colleagues later.</p>
      {plan ? <p className="alert ok">You’ll start on Starter. Upgrade to {plan} any time.</p> : null}
      {error ? <p className="alert">{error}</p> : null}
      {sent ? (
        <p className="alert ok">
          Check {email} to verify your address.
          {sent.verifyUrl ? (
            <>
              {" "}
              <Link to={pathFromUrl(sent.verifyUrl)}>Open the development link</Link>
            </>
          ) : null}
        </p>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          <TextInput id="name" label="Your name" value={name} onChange={setName} required />
          <TextInput id="org" label="Organisation" value={orgName} onChange={setOrgName} required />
          <EmailField value={email} onChange={setEmail} />
          <button className="btn primary full" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}

const verifyingTokens = new Set<string>();

export function VerifyPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("This sign-in link is missing a token.");
      return;
    }
    if (started.current || verifyingTokens.has(token)) return;
    started.current = true;
    verifyingTokens.add(token);
    const draft = getSignupDraft();
    void (async () => {
      try {
        const result = await api<{ accessToken: string }>("/v1/auth/verify", {
          body: {
            token,
            name: draft?.name,
            orgName: draft?.orgName,
          },
        });
        setSignupDraft(null);
        await setSession(result.accessToken);
        const next = draft?.type ? `/app/new?type=${encodeURIComponent(draft.type)}` : "/app";
        navigate(next, { replace: true });
      } catch (err) {
        started.current = false;
        verifyingTokens.delete(token);
        setError(err instanceof ApiError ? err.message : "This sign-in link is invalid or has expired.");
      }
    })();
  }, [navigate, params, setSession]);

  return (
    <AuthShell>
      <h1>Signing you in</h1>
      {error ? (
        <>
          <p className="alert">{error}</p>
          <Link className="btn primary" to="/login">Request a new link</Link>
        </>
      ) : (
        <p>One moment…</p>
      )}
    </AuthShell>
  );
}

function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, "") || "/verify";
  }
}

function EmailField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="f">
      <label htmlFor="email">Email</label>
      <div className="box">
        <input
          id="email"
          className="t"
          type="email"
          required
          autoComplete="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  return (
    <div className="f">
      <label htmlFor={id}>{label}</label>
      <div className="box">
        <input id={id} className="t" required={required} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header className="lnav">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
      </header>
      <div className="authcard">{children}</div>
    </div>
  );
}
