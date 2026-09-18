import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import { api, ApiError } from "../../lib/api.js";
import {
  BUILDING_TYPES,
  CURRENCIES,
  MEASUREMENT_STANDARDS,
  NUMBER_FORMATS,
  STAGE_OPTIONS,
  type BuildingTypeId,
  defaultStandard,
  isAllowedType,
} from "../../lib/catalog.js";
import type { ProjectRecord } from "../../lib/types.js";
import { AppShell } from "./AppShell.js";

const STEPS = ["Type", "Currency", "Standard", "Cover"] as const;

interface Stakeholder {
  role: string;
  org: string;
  contact: string;
}

export function NewProjectWizard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const allowed = auth.entitlements?.types ?? ["FOUNDATION", "SINGLE"];
  const initialType = (params.get("type") as BuildingTypeId | null) ?? "SINGLE";
  const [step, setStep] = useState(0);
  const [buildingType, setBuildingType] = useState<BuildingTypeId>(
    isAllowedType(initialType, allowed) ? initialType : "SINGLE",
  );
  const [currency, setCurrency] = useState("USD");
  const [currencyCustom, setCurrencyCustom] = useState("");
  const [numberLocale, setNumberLocale] = useState("en-GB");
  const [taxName, setTaxName] = useState("VAT");
  const [taxRate, setTaxRate] = useState("0");
  const [contingencyRate, setContingencyRate] = useState("5");
  const [standard, setStandard] = useState(() => defaultStandard(isAllowedType(initialType, allowed) ? initialType : "SINGLE"));
  const [customStandard, setCustomStandard] = useState("");
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [revision, setRevision] = useState("A");
  const [stage, setStage] = useState("PRE_TENDER");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [drawings, setDrawings] = useState("");
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([
    { role: "Client", org: "", contact: "" },
    { role: "Quantity surveyor", org: "", contact: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = useMemo(
    () => BUILDING_TYPES.filter((item) => !isAllowedType(item.id, allowed)).map((item) => item.id),
    [allowed],
  );

  function pickType(next: BuildingTypeId) {
    if (!isAllowedType(next, allowed)) return;
    setBuildingType(next);
    setStandard(defaultStandard(next));
  }

  function nextStep() {
    setError(null);
    if (step === 0 && !isAllowedType(buildingType, allowed)) {
      setError("Upgrade to Professional for this project type.");
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      nextStep();
      return;
    }
    if (!auth.token) return;
    setBusy(true);
    setError(null);
    const currencyCode = currency === "OTHER" ? currencyCustom.trim().toUpperCase() : currency;
    try {
      const created = await api<ProjectRecord>("/v1/projects", {
        token: auth.token,
        orgId: auth.orgId,
        body: {
          name: name.trim() || undefined,
          buildingType,
          stage,
          currency: currencyCode || "USD",
          numberLocale,
          taxName: taxName.trim() || "VAT",
          taxRate: Number(taxRate) || 0,
          contingencyRate: Number(contingencyRate) || 0,
        },
      });
      await api(`/v1/projects/${created.id}/settings`, {
        method: "PATCH",
        token: auth.token,
        orgId: auth.orgId,
        body: {
          reference: reference.trim() || null,
          revision: revision.trim() || null,
          description: description.trim() || null,
          location: location.trim() || null,
          drawings: drawings.trim() || null,
          measurementBasis: standard === "CUSTOM" ? customStandard.trim() || "Custom" : standard,
          currencyCustom: currency === "OTHER" ? currencyCustom.trim().toUpperCase() : null,
          stakeholders: stakeholders.filter((row) => row.role || row.org || row.contact),
        },
      });
      navigate(`/app/p/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New project" subtitle="Four steps · saved to your workspace">
      <main className="mx-auto max-w-[880px] px-6 py-8">
        <div className="pagehead">
          <h1>New project</h1>
          <p>Choose the work, currency and measurement standard, then name the cover page.</p>
        </div>
        <div className="wizsteps" aria-label="Wizard steps">
          {STEPS.map((label, index) => (
            <span key={label} className={index === step ? "on" : undefined}>
              {index + 1}. {label}
            </span>
          ))}
        </div>
        {error ? <p className="alert">{error}</p> : null}
        <form className="stack" onSubmit={onSubmit}>
          {step === 0 ? (
            <>
              {["Buildings", "Civil works"].map((group) => (
                <section key={group} className="mb-4">
                  <h2 className="mb-2 text-sm font-semibold text-muted">{group}</h2>
                  <div className="btcards">
                    {BUILDING_TYPES.filter((item) => item.group === group).map((item) => {
                      const gated = locked.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="btcard"
                          aria-pressed={buildingType === item.id}
                          disabled={gated}
                          onClick={() => pickType(item.id)}
                        >
                          <b>{item.label}</b>
                          <span>{item.blurb}</span>
                          {gated ? <span>Professional plan</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
              {locked.length ? (
                <p className="text-sm text-muted">
                  Multi-storey, roads and bridges need Professional. <Link to="/pricing">See plans</Link>.
                </p>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <div className="fg">
              <div className="f">
                <label htmlFor="currency">Currency</label>
                <div className="box">
                  <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                    {CURRENCIES.map(([code, label]) => (
                      <option key={code} value={code}>{code} — {label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {currency === "OTHER" ? (
                <div className="f">
                  <label htmlFor="ccode">Custom code</label>
                  <div className="box">
                    <input id="ccode" className="t" maxLength={8} value={currencyCustom} onChange={(event) => setCurrencyCustom(event.target.value)} />
                  </div>
                </div>
              ) : null}
              <div className="f">
                <label htmlFor="locale">Number format</label>
                <div className="box">
                  <select id="locale" value={numberLocale} onChange={(event) => setNumberLocale(event.target.value)}>
                    {NUMBER_FORMATS.map(([code, sample]) => (
                      <option key={code} value={code}>{code} · {sample}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="f">
                <label htmlFor="taxName">Tax name</label>
                <div className="box">
                  <input id="taxName" className="t" value={taxName} onChange={(event) => setTaxName(event.target.value)} />
                </div>
              </div>
              <div className="f">
                <label htmlFor="taxRate">Tax rate %</label>
                <div className="box">
                  <input id="taxRate" className="t" inputMode="decimal" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
                </div>
              </div>
              <div className="f">
                <label htmlFor="contingency">Contingency %</label>
                <div className="box">
                  <input id="contingency" className="t" inputMode="decimal" value={contingencyRate} onChange={(event) => setContingencyRate(event.target.value)} />
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="btcards">
              {MEASUREMENT_STANDARDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="btcard"
                  aria-pressed={standard === item.value}
                  onClick={() => setStandard(item.value)}
                >
                  <b>{item.label}</b>
                  <span>{item.hint}</span>
                </button>
              ))}
              {standard === "CUSTOM" ? (
                <div className="f" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="customStd">Standard name</label>
                  <div className="box">
                    <input id="customStd" className="t" value={customStandard} onChange={(event) => setCustomStandard(event.target.value)} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <>
              <div className="fg">
                <div className="f">
                  <label htmlFor="pname">Project name</label>
                  <div className="box">
                    <input id="pname" className="t" required value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="pref">Reference</label>
                  <div className="box">
                    <input id="pref" className="t" value={reference} onChange={(event) => setReference(event.target.value)} />
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="prev">Revision</label>
                  <div className="box">
                    <input id="prev" className="t" value={revision} onChange={(event) => setRevision(event.target.value)} />
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="pstage">Stage</label>
                  <div className="box">
                    <select id="pstage" value={stage} onChange={(event) => setStage(event.target.value)}>
                      {STAGE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="f" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="pdesc">Description</label>
                  <div className="box">
                    <input id="pdesc" className="t" value={description} onChange={(event) => setDescription(event.target.value)} />
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="ploc">Location</label>
                  <div className="box">
                    <input id="ploc" className="t" value={location} onChange={(event) => setLocation(event.target.value)} />
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="pdraw">Drawings</label>
                  <div className="box">
                    <input id="pdraw" className="t" value={drawings} onChange={(event) => setDrawings(event.target.value)} />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted">Cover image upload ships with file storage in a later phase.</p>
              <h3 className="mt-4 font-cond text-xl">Stakeholders</h3>
              {stakeholders.map((row, index) => (
                <div className="fg" key={index}>
                  <div className="f">
                    <label htmlFor={`role-${index}`}>Role</label>
                    <div className="box">
                      <input
                        id={`role-${index}`}
                        className="t"
                        value={row.role}
                        onChange={(event) => {
                          const next = [...stakeholders];
                          next[index] = { ...row, role: event.target.value };
                          setStakeholders(next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="f">
                    <label htmlFor={`org-${index}`}>Organisation</label>
                    <div className="box">
                      <input
                        id={`org-${index}`}
                        className="t"
                        value={row.org}
                        onChange={(event) => {
                          const next = [...stakeholders];
                          next[index] = { ...row, org: event.target.value };
                          setStakeholders(next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="f" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor={`contact-${index}`}>Contact</label>
                    <div className="box">
                      <input
                        id={`contact-${index}`}
                        className="t"
                        value={row.contact}
                        onChange={(event) => {
                          const next = [...stakeholders];
                          next[index] = { ...row, contact: event.target.value };
                          setStakeholders(next);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {step > 0 ? (
              <button className="btn" type="button" onClick={() => setStep((current) => current - 1)}>
                Back
              </button>
            ) : (
              <Link className="btn" to="/app">Cancel</Link>
            )}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : step === STEPS.length - 1 ? "Create project" : "Continue"}
            </button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
