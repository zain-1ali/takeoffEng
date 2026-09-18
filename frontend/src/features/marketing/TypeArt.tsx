export function TypeArt({ kind }: { kind: string }) {
  const k = kind.toLowerCase();
  if (k === "road") {
    return (
      <svg viewBox="0 0 320 150" aria-hidden="true">
        <rect width="320" height="150" fill="var(--paper)" />
        <path d="M0 88h320" stroke="var(--line)" />
        <path d="M40 96h240l20 28H20z" fill="var(--sunk)" stroke="var(--ink)" />
        <path d="M160 96v28" stroke="var(--hivis)" strokeDasharray="8 8" />
      </svg>
    );
  }
  if (k === "bridge") {
    return (
      <svg viewBox="0 0 320 150" aria-hidden="true">
        <rect width="320" height="150" fill="var(--paper)" />
        <path d="M20 110h280" stroke="var(--soil-dark)" />
        <path d="M40 110v-36h40v36M240 110v-36h40v36" fill="var(--conc)" stroke="var(--ink)" />
        <path d="M40 74h240" stroke="var(--ink)" strokeWidth="6" />
        <path d="M80 74c40-28 120-28 160 0" fill="none" stroke="var(--core)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <rect width="320" height="150" fill="var(--paper)" />
      <rect x="70" y="48" width="180" height="78" fill="var(--conc)" stroke="var(--ink)" />
      <rect x="70" y="108" width="180" height="18" fill="var(--soil)" stroke="var(--ink)" />
      <rect x="148" y="78" width="24" height="48" fill="var(--core)" />
      <path d="M70 48h180" stroke="var(--steel)" strokeWidth="3" />
    </svg>
  );
}
