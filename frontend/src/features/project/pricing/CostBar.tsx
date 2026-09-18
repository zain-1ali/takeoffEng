import { CAT_COLOR, RATE_CATEGORIES } from "./helpers.js";

export function CostBar({
  categories,
  tools = 0,
}: {
  categories: Record<string, number>;
  tools?: number;
}) {
  const total = RATE_CATEGORIES.reduce((sum, cat) => sum + (categories[cat] ?? 0), 0) + tools || 1;
  const slices = RATE_CATEGORIES
    .map((label) => ({ label, value: categories[label] ?? 0 }))
    .filter((row) => row.value > 0);
  if (!slices.length) return <div className="cbar" role="img" aria-label="Cost split" />;
  return (
    <>
      <div className="cbar" role="img" aria-label="Cost split">
        {slices.map((row) => (
          <span
            key={row.label}
            style={{ width: `${(row.value / total) * 100}%`, background: CAT_COLOR[row.label] }}
            title={`${row.label} ${Math.round((row.value / total) * 100)}%`}
          />
        ))}
      </div>
      <div className="clegend">
        {slices.map((row) => (
          <span key={row.label}>
            <i style={{ background: CAT_COLOR[row.label] }} />
            {row.label} {Math.round((row.value / total) * 100)}%
          </span>
        ))}
      </div>
    </>
  );
}
