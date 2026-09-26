import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { useProject } from "../project/ProjectProvider.js";
import { useCollab, type CollabTask } from "./CollabProvider.js";
import { ago, initials, viewLabel } from "./roles.js";

const COLUMNS: Array<[CollabTask["status"], string]> = [
  ["TODO", "To do"],
  ["DOING", "In progress"],
  ["REVIEW", "For review"],
  ["DONE", "Done"],
];

export function TeamScreen() {
  const auth = useAuth();
  const { meta, sync, error, reload, overwriteMine } = useProject();
  const collab = useCollab();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const conflict = sync === "conflict";

  const assignees = useMemo(() => {
    const ids = new Set([
      auth.user?.id,
      ...collab.members.map((row) => row.id),
      ...collab.peers.map((row) => row.userId),
    ]);
    return [...ids].filter(Boolean).map((id) => collab.people[id!] ?? { id: id!, name: "Member" });
  }, [auth.user?.id, collab.members, collab.peers, collab.people]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await collab.addTask(title.trim(), assigneeId, dueDate);
    setTitle("");
    setAssigneeId("");
    setDueDate("");
  }

  return (
    <div>
      <div className="pagehead">
        <h1>Team workspace</h1>
        <p>Share this project with your organisation, see who is working on it, discuss bill items and track checking tasks.</p>
      </div>
      {!collab.canWrite && !collab.canTalk ? (
        <p className="alert warnish">You have view-only access: you can open shared projects but not save, comment or edit tasks.</p>
      ) : null}
      <section className={`tcard hero ${conflict ? "warn" : ""}`}>
        <div>
          <h3>{meta?.name ?? "This project"}</h3>
          <p>
            {conflict
              ? <b>A newer version was saved while you had unsaved changes.</b>
              : sync === "unsaved" || sync === "saving"
                ? "You have unsaved changes."
                : "You are up to date."}
            {error ? ` ${error}` : ""}
          </p>
        </div>
        <div className="tact">
          {conflict ? (
            <>
              <button className="btn primary" type="button" onClick={() => void reload()}>Load their version</button>
              <button className="btn danger" type="button" disabled={!collab.canWrite} onClick={() => void overwriteMine()}>
                Overwrite with mine
              </button>
            </>
          ) : (
            <button className="btn" type="button" onClick={() => collab.openComments({ anchorType: "PROJECT", anchorId: "_project", title: "Project comments" })}>
              Project comments
            </button>
          )}
        </div>
      </section>
      <div className="tgrid">
        <section className="tcard">
          <h3>Online now <span className="tag">{new Set(collab.peers.map((peer) => peer.userId)).size}</span></h3>
          {collab.peers.length ? collab.peers.map((peer) => (
            <div className="onl" key={peer.userId}>
              <span className="av">{initials(peer.name)}</span>
              <div>
                <b>{peer.name}</b>
                <small>
                  {peer.projectId && peer.projectId === meta?.id ? "In this project" : "Elsewhere in the workspace"}
                  {" · "}{viewLabel(peer.view)}
                  {peer.item ? ` · item ${peer.item}` : ""}
                </small>
              </div>
            </div>
          )) : <p className="muted">Nobody else is online.</p>}
        </section>
        <section className="tcard">
          <h3>Activity</h3>
          <ul className="act">
            {collab.activity.length ? collab.activity.map((row) => (
              <li key={row.id}>
                <span className="av sm">{initials(collab.people[row.actorId]?.name ?? "?")}</span>
                <div>
                  <b>{collab.people[row.actorId]?.name ?? "Someone"}</b> {row.text}
                  <small>{ago(row.createdAt)}</small>
                </div>
              </li>
            )) : <li className="muted">No activity yet.</li>}
          </ul>
        </section>
      </div>
      <section className="tcard">
        <h3>Tasks</h3>
        {collab.canWrite ? (
          <form className="taskadd" onSubmit={(event) => void onAdd(event)}>
            <div className="box">
              <input className="t" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Check Bill 5 – suspended slabs" aria-label="Task" />
            </div>
            <div className="box">
              <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} aria-label="Assignee">
                <option value="">Unassigned</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
            <div className="box">
              <input className="t" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Due date" />
            </div>
            <button className="btn primary" type="submit">Add task</button>
          </form>
        ) : null}
        <div className="kanban">
          {COLUMNS.map(([status, label]) => {
            const cards = collab.tasks.filter((task) => task.status === status);
            return (
              <div className="kcol" key={status}>
                <h4>{label} <span>{cards.length}</span></h4>
                {cards.map((task) => (
                  <div className="kcard" key={task.id}>
                    <b>{task.title}</b>
                    <small>
                      {task.assigneeId ? `${collab.people[task.assigneeId]?.name ?? "Assigned"}` : "Unassigned"}
                      {task.dueDate ? ` · due ${task.dueDate}` : ""}
                    </small>
                    {collab.canWrite ? (
                      <div className="kact">
                        {COLUMNS.filter(([key]) => key !== status).map(([key, next]) => (
                          <button key={key} className="chip" type="button" onClick={() => void collab.moveTask(task.id, key)}>{next}</button>
                        ))}
                        <button className="x" type="button" aria-label="Delete task" onClick={() => void collab.deleteTask(task.id)}>×</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
