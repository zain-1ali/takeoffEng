import { Link } from "react-router-dom";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const title = kind === "privacy" ? "Privacy" : "Terms";
  return (
    <div>
      <header className="lnav">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
      </header>
      <main className="lsec" style={{ maxWidth: 760 }}>
        <div className="pagehead">
          <h1>{title}</h1>
          <p>
            {kind === "privacy"
              ? "TakeOff Studio stores your account, organisation and project data so you can measure and price work with your team. We do not sell personal data."
              : "Use TakeOff Studio for professional quantity surveying take-off. You remain responsible for the quantities, rates and reports you issue."}
          </p>
        </div>
        <p className="mt-6 text-muted">
          A full policy will ship with hosted billing. Until then, treat this instance as a private workspace
          for your practice.
        </p>
        <p className="mt-4"><Link to="/">Back to home</Link></p>
      </main>
    </div>
  );
}
