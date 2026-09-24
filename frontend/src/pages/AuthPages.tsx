import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.js";
import { api, ApiError } from "../lib/api.js";
import { loadGoogleIdentity, type GoogleProviders } from "../lib/google.js";

interface AuthSession {
  accessToken: string;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [busy, setBusy] = useState(false);
  const google = useGoogleClientId();

  useEffect(() => {
    if (auth.ready && auth.user) navigate(next, { replace: true });
  }, [auth.ready, auth.user, navigate, next]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<AuthSession>("/v1/auth/login", {
        body: { email, password },
      });
      await auth.setSession(result.accessToken);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1>Sign in</h1>
      <p>Use the email and password for your workspace.</p>
      {error ? <p className="alert">{error}</p> : null}
      <form className="stack" onSubmit={onSubmit}>
        <EmailField value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        <button className="btn primary full" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <GoogleSignIn
        clientId={google}
        busy={busy}
        onBusy={setBusy}
        onError={setError}
        onSession={async (token) => {
          await auth.setSession(token);
          navigate(next, { replace: true });
        }}
      />
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
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [busy, setBusy] = useState(false);
  const google = useGoogleClientId();
  const type = params.get("type") ?? undefined;
  const plan = params.get("plan");
  const next = params.get("next");

  useEffect(() => {
    if (auth.ready && auth.user) navigate(next || "/app", { replace: true });
  }, [auth.ready, auth.user, navigate, next]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<AuthSession>("/v1/auth/signup", {
        body: { email, password, name, orgName },
      });
      await auth.setSession(result.accessToken);
      const destination = next || (type ? `/app/new?type=${encodeURIComponent(type)}` : "/app");
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your workspace.");
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
      <form className="stack" onSubmit={onSubmit}>
        <TextInput id="name" label="Your name" value={name} onChange={setName} required autoComplete="name" />
        <TextInput id="org" label="Organisation" value={orgName} onChange={setOrgName} required autoComplete="organization" />
        <EmailField value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
        <button className="btn primary full" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create workspace"}
        </button>
      </form>
      <GoogleSignIn
        clientId={google}
        name={name}
        orgName={orgName}
        busy={busy}
        onBusy={setBusy}
        onError={setError}
        onSession={async (token) => {
          await auth.setSession(token);
          navigate(next || (type ? `/app/new?type=${encodeURIComponent(type)}` : "/app"), { replace: true });
        }}
      />
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function GoogleSignIn({
  clientId,
  name,
  orgName,
  busy,
  onBusy,
  onError,
  onSession,
}: {
  clientId: string | null;
  name?: string;
  orgName?: string;
  busy: boolean;
  onBusy: (next: boolean) => void;
  onError: (message: string | null) => void;
  onSession: (token: string) => Promise<void>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const extras = useRef({ name, orgName, onSession, onError, onBusy });
  extras.current = { name, orgName, onSession, onError, onBusy };

  useEffect(() => {
    if (!clientId || !host.current) return;
    let alive = true;
    void loadGoogleIdentity()
      .then((google) => {
        if (!alive || !host.current) return;
        google.initialize({
          client_id: clientId,
          callback: (response) => {
            void (async () => {
              extras.current.onBusy(true);
              extras.current.onError(null);
              try {
                const result = await api<AuthSession>("/v1/auth/google", {
                  body: {
                    idToken: response.credential,
                    name: extras.current.name?.trim() || undefined,
                    orgName: extras.current.orgName?.trim() || undefined,
                  },
                });
                await extras.current.onSession(result.accessToken);
              } catch (err) {
                extras.current.onError(err instanceof ApiError ? err.message : "Could not sign in with Google.");
              } finally {
                extras.current.onBusy(false);
              }
            })();
          },
        });
        host.current.innerHTML = "";
        google.renderButton(host.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 360,
        });
      })
      .catch(() => {
        extras.current.onError("Could not load Google sign-in.");
      });
    return () => {
      alive = false;
    };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <>
      <p className="orline">or</p>
      <div className="googlebtn" ref={host} hidden={busy} />
    </>
  );
}

function useGoogleClientId(): string | null {
  const [clientId, setClientId] = useState<string | null>(null);
  useEffect(() => {
    void api<GoogleProviders>("/v1/auth/providers")
      .then((result) => setClientId(result.google && result.clientId ? result.clientId : null))
      .catch(() => setClientId(null));
  }, []);
  return clientId;
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

function PasswordField({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="f">
      <label htmlFor="password">Password</label>
      <div className="box">
        <input
          id="password"
          className="t"
          type="password"
          required
          minLength={8}
          autoComplete={autoComplete}
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
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="f">
      <label htmlFor={id}>{label}</label>
      <div className="box">
        <input
          id={id}
          className="t"
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
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
