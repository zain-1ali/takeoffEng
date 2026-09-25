import { useOptionalCollab } from "./CollabProvider.js";

export function CommentButton({
  code,
  item,
  desc,
}: {
  code: string;
  item: string;
  desc?: string;
}) {
  const collab = useOptionalCollab();
  if (!collab) return null;
  const count = collab.openCount(code);
  return (
    <button
      className={count ? "cmt has" : "cmt"}
      type="button"
      aria-label={`Comments on item ${item}`}
      onClick={() => collab.openComments({
        anchorType: "BOQ_ITEM",
        anchorId: code,
        title: `Item ${item}`,
        detail: desc,
      })}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {count ? <span>{count}</span> : null}
    </button>
  );
}
