import type { ReactNode } from "react";
import { n } from "@takeoff/engine";
import { Link, useParams } from "react-router-dom";
import { NumberField } from "../../../ui/index.js";
import { stringOf } from "../../../lib/doc.js";
import { raOf } from "./helpers.js";
import { useProject } from "../ProjectProvider.js";
import { useDatabank } from "./DatabankProvider.js";

export function FxBanner({
  projectCurrency,
  extra,
}: {
  projectCurrency: string;
  extra?: ReactNode;
}) {
  const { id } = useParams();
  const { doc, setPath } = useProject();
  const databank = useDatabank();
  const ra = raOf(doc);
  const db = (databank.currency || ra.cur || "USD").toUpperCase();
  const project = projectCurrency.toUpperCase();
  if (!db || db === project) return extra ? <>{extra}</> : null;
  return (
    <div className="alert warnish">
      Databank prices are in <b>{db}</b> and shown here converted at 1 {db} ={" "}
      <label className="mini" style={{ display: "inline-flex" }}>
        <NumberField compact step={0.01} value={stringOf(ra.fx, String(n(ra.fx) || 1))} onChange={(value) => setPath("ra.fx", value)} />
      </label>{" "}
      {project}. {extra}
      {id ? <Link className="btn sm" to={`/app/p/${id}/project`}>Change project currency</Link> : null}
    </div>
  );
}

export function convertConfirm(count: number, fx: number, currency: string): boolean {
  return window.confirm(`Multiply all ${count} databank prices by ${fx} and store them in ${currency}?`);
}
