import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { useCollab } from "./CollabProvider.js";
import { ago, initials } from "./roles.js";

export function CommentDrawer() {
  const auth = useAuth();
  const collab = useCollab();
  const [text, setText] = useState("");
  if (!collab.target) return null;
  const thread = collab.comments.filter((row) => row.anchorId === collab.target?.anchorId);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await collab.postComment(text.trim());
    setText("");
  }

  return (
    <dialog className="drawer" open>
      <div className="drw">
        <header>
          <div>
            <small>Comments</small>
            <h3>{collab.target.title}</h3>
            {collab.target.detail ? <small>{collab.target.detail}</small> : null}
          </div>
          <button className="btn sm" type="button" onClick={collab.closeComments}>Close</button>
        </header>
        <div className="thread">
          {thread.length ? thread.map((row) => (
            <div className={`cm ${row.resolvedAt ? "res" : ""}`} key={row.id}>
              <span className="av">{initials(collab.people[row.authorId]?.name ?? "?")}</span>
              <div>
                <div className="cmh">
                  <b>{collab.people[row.authorId]?.name ?? "Someone"}</b>
                  <small>{ago(row.createdAt)}</small>
                </div>
                <p>{row.body}</p>
                <div className="cma">
                  {collab.canTalk ? (
                    <button className="chip" type="button" onClick={() => void collab.resolveComment(row.id, !row.resolvedAt)}>
                      {row.resolvedAt ? "Reopen" : "Resolve"}
                    </button>
                  ) : null}
                  {row.authorId === auth.user?.id ? (
                    <button className="chip" type="button" onClick={() => void collab.deleteComment(row.id)}>Delete</button>
                  ) : null}
                </div>
              </div>
            </div>
          )) : (
            <p className="muted">No comments yet. Ask a question about this {collab.target.anchorType === "PROJECT" ? "project" : "item"}.</p>
          )}
        </div>
        {collab.canTalk ? (
          <form className="composer" onSubmit={(event) => void onSend(event)}>
            <div className="box">
              <textarea id="cmText" rows={3} placeholder="Write a comment" value={text} onChange={(event) => setText(event.target.value)} />
            </div>
            <button className="btn primary" type="submit">Post</button>
          </form>
        ) : null}
      </div>
    </dialog>
  );
}
