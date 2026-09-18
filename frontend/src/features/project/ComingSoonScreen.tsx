import { LATER } from "./schema.js";

export function ComingSoonScreen({ view }: { view: string }) {
  return (
    <div className="pagehead">
      <h1>Coming next</h1>
      <p>{LATER[view] ?? "This screen is not in this phase."}</p>
    </div>
  );
}
