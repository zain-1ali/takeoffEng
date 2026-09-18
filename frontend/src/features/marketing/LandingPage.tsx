import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import { HeroPreview } from "./HeroPreview.js";
import { PricingSection } from "./PricingSection.js";
import { TypeArt } from "./TypeArt.js";

const FEATURES: [string, string, string][] = [
  ["Measure like a QS", "Member schedules, level-by-level placements, bar-by-bar reinforcement and a traditional dimension sheet.", "M3 9h18M3 15h18M9 3v18"],
  ["Bills that price themselves", "Every item is built up from a resource databank of labour, materials and plant, with overheads and profit.", "M4 19V5m6 14V9m6 10V3m4 16H2"],
  ["Buildings, roads and bridges", "Foundations to multi-storey frames, chainage-based roads with drainage, and multi-span concrete bridges.", "M3 21h18M5 21V10l7-5 7 5v11"],
  ["Reports clients read", "Cover page, charted summary, bills, bill of materials and rate analysis – print, PDF or Excel.", "M6 2h9l5 5v15H6zM14 2v6h6"],
  ["Work together", "Share a project, see who is online, comment on bill items and track tasks through to issue.", "M16 11a4 4 0 1 0-8 0M3 21a9 9 0 0 1 18 0"],
  ["Any currency, any market", "Pick a currency and number format, set tax and contingency, and convert your databank in one step.", "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const FAQS: [string, string][] = [
  ["Which measurement standards are supported?", "Building work follows NRM2 principles and civil work follows CESMM4 principles by default. You can set your own standard name, and descriptions, depth bands and units are editable through the rate analysis and project settings."],
  ["Can I use my own prices and currency?", "Yes. Import your resource databank as CSV, choose any currency and number format, and convert databank prices with an exchange rate."],
  ["How does collaboration work?", "In the team workspace a project is shared with your organisation. Everyone sees who is online, can comment on bill items, pick up tasks and load the latest saved version. Changes are saved as versions, and the app warns you before overwriting a newer save."],
  ["Where is my data kept?", "Your own projects are kept in your organisation workspace. Shared projects stay with the team; you can export Excel and PDF at any time."],
  ["Can I cancel or change plans?", "Plans are monthly or annual and can be changed or cancelled at any time; annual plans run to the end of the paid year."],
];

export function LandingPage() {
  const auth = useAuth();
  const appHref = auth.user ? "/app" : "/signup";

  return (
    <div>
      <header className="lnav">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
        <nav aria-label="Site">
          <a href="#features">Features</a>
          <a href="#types">Project types</a>
          <a href="#collab">Collaboration</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lnavact">
          <span className="planpill">Plan: <b>{auth.plan === "STARTER" ? "Starter" : auth.plan}</b></span>
          {auth.user ? (
            <Link className="btn primary" to="/app">Open the app</Link>
          ) : (
            <>
              <Link className="btn ghost" to="/login">Sign in</Link>
              <Link className="btn primary" to="/signup">Open the app</Link>
            </>
          )}
        </div>
      </header>

      <section className="lhero">
        <div>
          <span className="eyebrowchip">Take-off · Rate analysis · Reports · Collaboration</span>
          <h1>From drawings to a priced, charted bill of quantities – in one place.</h1>
          <p>
            Measure buildings, roads and concrete bridges with full bar detail, price every item from your own
            resource databank, and issue reports your client can read. In any currency, with your whole team.
          </p>
          <div className="lhcta">
            <Link className="btn primary lg" to={appHref}>Start a free take-off</Link>
            <a className="btn lg" href="#pricing">See plans</a>
          </div>
          <ul className="lhpoints">
            <li>NRM2 and CESMM4 principles</li>
            <li>Bar-by-bar reinforcement</li>
            <li>Works in your browser</li>
          </ul>
        </div>
        <HeroPreview />
      </section>

      <section className="lstrip">
        <span>Measurement</span>
        <b>NRM2</b><b>CESMM4</b><b>Your own standard</b>
        <span>Outputs</span>
        <b>BOQ</b><b>BBS</b><b>BOM</b><b>Rate analysis</b><b>Excel</b><b>PDF</b>
      </section>

      <section className="lsec" id="features">
        <div className="lsh">
          <h2>Everything a take-off needs, connected</h2>
          <p>Change a column size, a bar diameter or a cement price and the dimension sheet, bar schedule, rates, bill and dashboard all update together.</p>
        </div>
        <div className="lfeat">
          {FEATURES.map(([title, body, path]) => (
            <article key={title}>
              <span className="ficon"><Icon path={path} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lsec alt" id="how">
        <div className="lsh"><h2>Three steps from drawings to tender</h2></div>
        <ol className="lsteps">
          <li><b>1</b><h3>Set up the project</h3><p>Choose the project type, currency and standard, add stakeholders and a cover image.</p></li>
          <li><b>2</b><h3>Measure from the drawings</h3><p>Schedule member types once, then place them level by level, section by section or span by span.</p></li>
          <li><b>3</b><h3>Price and issue</h3><p>Rates build up from your databank. Review the dashboard, comment with your team and export the reports.</p></li>
        </ol>
      </section>

      <section className="lsec" id="types">
        <div className="lsh"><h2>Built for the work you actually price</h2></div>
        <div className="ltypes">
          {([
            ["MULTI", "Buildings", "Foundations only, single-storey and multi-storey frames with columns, beams, slabs, walls, stairs and lift cores."],
            ["ROAD", "Roads", "Chainage sections with cut and fill, pavement layers, side drains, pipe culverts and road furniture."],
            ["BRIDGE", "Concrete bridges", "Footings, piers, abutments and wingwalls, girders, deck and approach slabs, bearings and finishes."],
          ] as const).map(([type, title, body]) => (
            <Link key={type} className="ltype" to={`/signup?type=${type}`}>
              <div className="ltart"><TypeArt kind={type} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
              <span className="lnk">Open an example →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lsec alt" id="collab">
        <div className="lcollab">
          <div>
            <span className="eyebrowchip">Team workspace</span>
            <h2>Measure, check and price together</h2>
            <ul className="lchk">
              <li><b>Shared projects</b> – publish a project to the workspace and pick up where a colleague left off.</li>
              <li><b>Live presence</b> – see who is online and which part of the project they are working on.</li>
              <li><b>Comments on bill items</b> – query a rate or a quantity right where it sits, then resolve it.</li>
              <li><b>Tasks and activity</b> – assign bills for checking and follow every save.</li>
            </ul>
            <Link className="btn primary" to={appHref}>Open the team workspace</Link>
          </div>
          <div className="lcmock">
            <div className="cmhead">
              <span className="av" style={{ background: "var(--core)" }}>AM</span>
              <span className="av" style={{ background: "var(--steel)" }}>JK</span>
              <span className="av" style={{ background: "var(--ok)" }}>SN</span>
              <small>3 online</small>
            </div>
            <div className="cmrow"><b>Item AT</b> Reinforced concrete in suspended slabs<em>2 comments</em></div>
            <div className="cmbubble">
              <span className="av sm" style={{ background: "var(--core)" }}>AM</span>
              <p>Slab thickness changed to 225 mm on rev C – can you re-check the soffit formwork?</p>
            </div>
            <div className="cmbubble me">
              <p>Updated the S1 type; formwork and the rate are refreshed. Marking this resolved.</p>
              <span className="av sm" style={{ background: "var(--ok)" }}>SN</span>
            </div>
            <div className="cmtasks">
              <span className="tchip2 doing">Checking · Bill 5</span>
              <span className="tchip2 done">Done · Bill 2</span>
              <span className="tchip2">To do · Rates</span>
            </div>
          </div>
        </div>
      </section>

      <PricingSection currentPlan={auth.user ? auth.plan : undefined} />

      <section className="lsec alt" id="faq">
        <div className="lsh"><h2>Questions</h2></div>
        <div className="faq">
          {FAQS.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lcta">
        <h2>Price your next project with confidence</h2>
        <p>Open the example, change a few sizes and watch the bill, rates and charts follow.</p>
        <Link className="btn primary lg" to={appHref}>Open the app</Link>
      </section>

      <footer className="lfoot">
        <Link to="/" className="lbrand"><span className="logo">T</span>TakeOff Studio</Link>
        <span>Take-off, rate analysis and reporting for quantity surveyors</span>
        <span>
          <Link to="/legal/privacy">Privacy</Link>
          {" · "}
          <Link to="/legal/terms">Terms</Link>
          {" · "}
          © {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
