import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatPlanPrice, MARKETING_PLANS, type PlanId } from "../../lib/plans.js";

export function PricingSection({ currentPlan }: { currentPlan?: string }) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const [currency, setCurrency] = useState("USD");
  const currencies = useMemo(() => ["USD", "EUR", "GBP", "RWF", "KES", "NGN", "ZAR", "GHS", "INR", "AED"], []);

  return (
    <section className="lsec" id="pricing">
      <div className="lsh">
        <h2>Simple plans that grow with your practice</h2>
        <p>Start free. Upgrade when you are ready to price live work or bring your team in.</p>
      </div>
      <div className="pctl">
        <div className="seg" role="group" aria-label="Billing cycle">
          <button type="button" aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}>
            Monthly
          </button>
          <button type="button" aria-pressed={cycle === "annual"} onClick={() => setCycle("annual")}>
            Annual <em>save 20%</em>
          </button>
        </div>
        <label className="pcur">
          Show prices in
          <span className="box">
            <select aria-label="Pricing currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <div className="plans">
        {MARKETING_PLANS.map((plan) => {
          const usd = cycle === "annual" ? plan.annual : plan.price;
          const current = currentPlan === plan.id;
          return (
            <article key={plan.id} className={`plan ${plan.popular ? "pop" : ""}`}>
              {plan.popular ? <span className="ptag">Most popular</span> : null}
              <h3>{plan.name}</h3>
              <p className="pbl">{plan.blurb}</p>
              <div className="pprice">
                <b>
                  {usd === null ? "Custom" : usd === 0 ? "Free" : formatPlanPrice(usd, currency)}
                </b>
                <small>
                  {usd === null
                    ? "annual agreement"
                    : usd === 0
                      ? plan.unit
                      : `${plan.unit}${cycle === "annual" ? ", billed yearly" : ""}`}
                </small>
                {plan.seatsMin > 1 && usd !== null ? <small>Minimum {plan.seatsMin} users</small> : null}
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                className={`btn ${plan.popular ? "primary" : ""} full`}
                to={plan.id === "STARTER" ? "/signup" : `/signup?plan=${plan.id as PlanId}`}
                aria-disabled={current}
              >
                {current ? "Current plan" : plan.cta}
              </Link>
            </article>
          );
        })}
      </div>
      <p className="pnote">
        {currency !== "USD" ? `Prices in ${currency} are approximate conversions from US dollars. ` : ""}
        Pay by card, mobile money (M-Pesa, MTN MoMo, Airtel Money) or bank transfer. Taxes are added at checkout where they apply.
      </p>
    </section>
  );
}
