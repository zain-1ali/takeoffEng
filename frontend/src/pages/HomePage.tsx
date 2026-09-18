import { ENGINE_VERSION, ping } from "@takeoff/engine";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Health = {
  status: string;
  service: string;
  engine: { version: string; ping: string };
};

export function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/health")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Health;
      })
      .then(setHealth)
      .catch((err: unknown) => {
        setHealthError(err instanceof Error ? err.message : "Could not reach API");
      });
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <header className="sticky top-0 z-30 flex min-h-[62px] flex-wrap items-center gap-3.5 bg-ink px-5 py-2.5 text-white">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-cond text-[21px] font-semibold leading-tight">
            TakeOff Studio
          </span>
          <small className="text-xs text-[#9fb0bf]">
            Structural works take-off · UI kit
          </small>
        </div>
        <Link
          to="/kit"
          className="rounded-md bg-hivis px-3.5 py-2 text-sm font-semibold text-ink no-underline"
        >
          Open UI kit
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-cond text-[34px] font-normal leading-tight">
          Phase 5
        </h1>
        <p className="mt-1 max-w-[75ch] text-muted">
          Design tokens, NumberField formulas, and the engine Web Worker are wired.
          Open the UI kit to type <code className="font-cond">20*15+4*2.5</code> and
          watch quantities recompute.
        </p>

        <section className="mt-6 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-[17px] font-bold">Engine package</h2>
          <p className="mt-2 font-cond text-lg font-semibold text-input">
            {ping()} · v{ENGINE_VERSION}
          </p>
        </section>

        <section className="mt-4 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-[17px] font-bold">API health</h2>
          {health ? (
            <p className="mt-2 text-ok">
              {health.service} {health.status} · engine {health.engine.ping} v
              {health.engine.version}
            </p>
          ) : healthError ? (
            <p className="mt-2 text-warn">
              API not running ({healthError}). Start the backend on port 4000.
            </p>
          ) : (
            <p className="mt-2 text-muted">Checking http://localhost:4000/health…</p>
          )}
        </section>
      </main>
    </div>
  );
}
