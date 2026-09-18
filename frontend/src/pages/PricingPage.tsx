import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.js";
import { PricingSection } from "../features/marketing/PricingSection.js";

export function PricingPage() {
  const auth = useAuth();
  return (
    <div>
      <header className="lnav">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
        <nav aria-label="Site">
          <Link to="/#features">Features</Link>
          <Link to="/#types">Project types</Link>
          <Link to="/pricing">Pricing</Link>
        </nav>
        <div className="lnavact">
          {auth.user ? (
            <Link className="btn primary" to="/app">Open the app</Link>
          ) : (
            <>
              <Link className="btn ghost" to="/login">Sign in</Link>
              <Link className="btn primary" to="/signup">Start free</Link>
            </>
          )}
        </div>
      </header>
      <PricingSection currentPlan={auth.user ? auth.plan : undefined} />
      <footer className="lfoot">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
        <span>
          <Link to="/legal/privacy">Privacy</Link>
          {" · "}
          <Link to="/legal/terms">Terms</Link>
        </span>
      </footer>
    </div>
  );
}
