import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.js";
import { api, ApiError } from "../lib/api.js";

export function InvitePage() {
  const { token } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<{ orgName: string; email: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api<{ orgName: string; email: string; role: string }>(`/v1/invitations/${token}`)
      .then(setPreview)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "This invitation is invalid.");
      });
  }, [token]);

  async function accept() {
    if (!token || !auth.token) return;
    setBusy(true);
    try {
      const result = await api<{ orgId: string }>(`/v1/invitations/${token}/accept`, {
        method: "POST",
        token: auth.token,
      });
      await auth.setSession(auth.token, result.orgId);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept the invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="lnav">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
      </header>
      <div className="authcard">
        <h1>Join a workspace</h1>
        {error ? <p className="alert">{error}</p> : null}
        {preview ? (
          <>
            <p>
              <b>{preview.orgName}</b> invited {preview.email} as {preview.role.toLowerCase()}.
            </p>
            {!auth.user ? (
              <>
                <Link className="btn primary full" to={`/login?next=/invite/${token}`}>
                  Sign in to accept
                </Link>
                <p className="mt-4 text-sm text-muted">
                  New here?{" "}
                  <Link to={`/signup?next=/invite/${token}`}>Create an account</Link>
                </p>
              </>
            ) : (
              <button className="btn primary full" type="button" disabled={busy} onClick={() => void accept()}>
                {busy ? "Joining…" : "Accept invitation"}
              </button>
            )}
          </>
        ) : !error ? (
          <p>Loading invitation…</p>
        ) : null}
      </div>
    </div>
  );
}
