import { useEffect, useId, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.js";
import { apiBlob } from "../../../lib/api.js";
import { stringOf, type DocMap } from "../../../lib/doc.js";
import type { ProjectRecord } from "../../../lib/types.js";
import { coverFields, moneyOrDash } from "./reportData.js";

export function printReport(): void {
  window.print();
}

export function ComputingNote({ status, error }: { status: string; error: string | null }) {
  if (status === "error") return <div className="alert">{error ?? "Engine failed"}</div>;
  if (status === "computing" || status === "idle") {
    return <p className="muted">Updating quantities…</p>;
  }
  return null;
}

export function PlanGate({
  allowed,
  title,
  children,
}: {
  allowed: boolean;
  title: string;
  children: string;
}) {
  if (allowed) return null;
  return (
    <div className="pagehead">
      <h1>{title}</h1>
      <p>
        {children}{" "}
        <Link to="/pricing">See plans</Link>
      </p>
    </div>
  );
}

export function ReportToolbar({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rtool no-print">
      <b>{title}</b>
      <span className="sp" />
      {children}
    </div>
  );
}

export function CoverHero({
  image,
  coverImageKey,
  fallbackType,
}: {
  image: string;
  coverImageKey: string | null;
  fallbackType: string;
}) {
  const { id } = useParams();
  const auth = useAuth();
  const [src, setSrc] = useState(image);

  useEffect(() => {
    if (!coverImageKey || !id || !auth.token) {
      setSrc(image);
      return;
    }
    let objectUrl = "";
    let cancelled = false;
    void apiBlob(`/v1/projects/${id}/cover`, { token: auth.token, orgId: auth.orgId })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(image);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [auth.orgId, auth.token, coverImageKey, id, image]);

  if (src) return <img src={src} alt="Project image" />;
  return <CoverArt btype={fallbackType} />;
}

export function CoverArt({ btype }: { btype: string }) {
  const rawId = useId().replace(/:/g, "");
  const patternId = `gridp-${rawId}`;
  let drawing: ReactNode = null;
  if (btype === "road") {
    drawing = (
      <>
        <path d="M0 260 L400 150 L800 260 Z" style={{ fill: "var(--conc)" }} opacity=".45" />
        <path d="M330 170 L470 170 L800 260 L0 260 Z" style={{ fill: "var(--ink)" }} opacity=".85" />
        {[0, 1, 2, 3, 4].map((index) => (
          <path
            key={index}
            d={`M${398 - index * 2} ${176 + index * 18} L${402 + index * 2} ${176 + index * 18} L${404 + index * 3} ${186 + index * 18} L${396 - index * 3} ${186 + index * 18} Z`}
            style={{ fill: "var(--hivis)" }}
          />
        ))}
      </>
    );
  } else if (btype === "bridge") {
    drawing = (
      <>
        <rect x="0" y="210" width="800" height="50" style={{ fill: "var(--core)" }} opacity=".35" />
        <rect x="60" y="120" width="680" height="22" style={{ fill: "var(--ink)" }} />
        {[260, 540].map((x) => (
          <rect key={x} x={x - 10} y="142" width="20" height="90" style={{ fill: "var(--ink)" }} opacity=".8" />
        ))}
        <rect x="40" y="120" width="30" height="110" style={{ fill: "var(--ink)" }} />
        <rect x="730" y="120" width="30" height="110" style={{ fill: "var(--ink)" }} />
        {Array.from({ length: 20 }, (_, index) => (
          <line key={index} x1={80 + index * 34} y1="104" x2={80 + index * 34} y2="120" style={{ stroke: "var(--ink)" }} strokeWidth="2" />
        ))}
        <line x1="70" y1="104" x2="730" y2="104" style={{ stroke: "var(--ink)" }} strokeWidth="2" />
      </>
    );
  } else {
    const floors = btype === "foundation" ? 1 : btype === "single" ? 1 : 4;
    const height = Math.min(26, 170 / floors);
    drawing = (
      <>
        <rect x="0" y="236" width="800" height="24" style={{ fill: "var(--soil)" }} opacity=".6" />
        {Array.from({ length: floors }, (_, index) => (
          <g key={index}>
            <rect x="250" y={236 - (index + 1) * height} width="300" height={height - 4} style={{ fill: "var(--conc)" }} opacity=".7" />
            {Array.from({ length: 6 }, (_, col) => (
              <rect
                key={col}
                x={266 + col * 46}
                y={236 - (index + 1) * height + 4}
                width="30"
                height={height - 12}
                style={{ fill: "var(--core)" }}
                opacity=".55"
              />
            ))}
            <rect x="244" y={236 - (index + 1) * height - 4} width="312" height="4" style={{ fill: "var(--ink)" }} />
          </g>
        ))}
        <rect x="600" y="40" width="6" height="196" style={{ fill: "var(--hivis)" }} />
        <rect x="520" y="40" width="150" height="6" style={{ fill: "var(--hivis)" }} />
      </>
    );
  }
  return (
    <svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" style={{ stroke: "var(--line)" }} strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="800" height="260" fill={`url(#${patternId})`} />
      {drawing}
    </svg>
  );
}

export function CoverPage({
  title,
  doc,
  meta,
  params,
}: {
  title: string;
  doc: DocMap | null;
  meta: ProjectRecord | null;
  params: readonly [string, string][];
}) {
  const cover = coverFields(doc, meta);
  return (
    <section className="page cover">
      <div className="chero">
        <CoverHero image={cover.image} coverImageKey={cover.coverImageKey} fallbackType={cover.btype} />
        <span className="cdoc">{title}</span>
      </div>
      <div className="cbody">
        <div className="ctitle">
          <div className="kicker">{cover.stage} · {cover.typeLabel}</div>
          <h1>{cover.name}</h1>
          {cover.desc ? <p>{cover.desc}</p> : null}
          {cover.location ? <div className="cloc">{cover.location}</div> : null}
        </div>
        <div className="cchips">
          {[
            ["Project ref.", cover.ref],
            ["Revision", cover.rev],
            ["Date", cover.date],
            ["Currency", cover.currency],
            ["Prepared by", cover.by],
          ].map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <b>{value || "–"}</b>
            </div>
          ))}
        </div>
        <div className="ccols">
          <div>
            <h3>Project parameters</h3>
            <dl className="cparams">
              {params.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3>Stakeholders</h3>
            {cover.stakeholders.length ? (
              <table className="csh">
                <tbody>
                  {cover.stakeholders.map((row) => (
                    <tr key={stringOf(row.role) + stringOf(row.org)}>
                      <th>{stringOf(row.role)}</th>
                      <td>
                        <b>{stringOf(row.org) || "–"}</b>
                        {stringOf(row.contact) ? <small>{stringOf(row.contact)}</small> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Add stakeholders in Project & type.</p>
            )}
            {cover.drawing ? (
              <>
                <h3 style={{ marginTop: 18 }}>Drawings</h3>
                <p className="cdraw">{cover.drawing}</p>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="cfoot">
        <span>{cover.ref} · Rev {cover.rev}</span>
        <span>{title}</span>
        <span>{cover.basis}</span>
      </div>
    </section>
  );
}

export function ReportHead({
  title,
  stamp,
  currency,
  basis,
  doc,
  meta,
}: {
  title: string;
  stamp: number;
  currency: string;
  basis: string;
  doc: DocMap | null;
  meta: ProjectRecord | null;
}) {
  const cover = coverFields(doc, meta);
  return (
    <>
      <div className="rhead">
        <div>
          <div className="kicker">{cover.typeLabel} · {currency}</div>
          <h1>{title}</h1>
          <div className="proj">{cover.name}</div>
        </div>
        <div className="stamp">
          <small>Total</small>
          <b>{moneyOrDash(stamp, 0)}</b>
          <small>{currency}</small>
        </div>
      </div>
      <div className="meta">
        {[
          ["Client", cover.client],
          ["Location", cover.location],
          ["Drawings", cover.drawing],
          ["Prepared by", cover.by],
          ["Date", cover.date],
          ["Basis", basis],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            {value || "–"}
          </div>
        ))}
      </div>
    </>
  );
}

export function SignBlock({ third, preparedBy }: { third: string; preparedBy: string }) {
  return (
    <div className="sign">
      <div>Prepared by<br /><b>{preparedBy || "\u00a0"}</b></div>
      <div>Checked by<br />&nbsp;</div>
      <div>{third}<br />&nbsp;</div>
    </div>
  );
}
