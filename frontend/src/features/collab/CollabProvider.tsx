import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { connectRealtime } from "../../lib/socket.js";
import { useAuth } from "../auth/AuthProvider.js";
import { canComment, canEdit } from "./roles.js";

export interface CollabPerson {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface CollabComment {
  id: string;
  projectId: string;
  anchorType: string;
  anchorId: string;
  body: string;
  authorId: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CollabTask {
  id: string;
  title: string;
  status: "TODO" | "DOING" | "REVIEW" | "DONE";
  assigneeId: string | null;
  dueDate: string | null;
  createdById: string;
}

export interface CollabActivity {
  id: string;
  actorId: string;
  verb: string;
  text: string;
  createdAt: string;
}

export interface PresencePeer {
  userId: string;
  name: string;
  projectId: string;
  view: string;
  item: string;
}

export interface CommentTarget {
  anchorType: string;
  anchorId: string;
  title: string;
  detail?: string;
}

interface BoardPayload {
  comments: CollabComment[];
  tasks: CollabTask[];
  activity: CollabActivity[];
  members: CollabPerson[];
}

interface CollabContextValue {
  comments: CollabComment[];
  tasks: CollabTask[];
  activity: CollabActivity[];
  members: CollabPerson[];
  people: Record<string, CollabPerson>;
  peers: PresencePeer[];
  target: CommentTarget | null;
  canWrite: boolean;
  canTalk: boolean;
  openComments: (target: CommentTarget) => void;
  closeComments: () => void;
  postComment: (body: string) => Promise<void>;
  resolveComment: (id: string, resolved: boolean) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  addTask: (title: string, assigneeId: string, dueDate: string) => Promise<void>;
  moveTask: (id: string, status: CollabTask["status"]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  openCount: (anchorId: string) => number;
}

const CollabContext = createContext<CollabContextValue | null>(null);

export function CollabProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { id, view } = useParams();
  const [board, setBoard] = useState<BoardPayload>({ comments: [], tasks: [], activity: [], members: [] });
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [target, setTarget] = useState<CommentTarget | null>(null);
  const socketRef = useRef<ReturnType<typeof connectRealtime> | null>(null);

  const load = useCallback(async () => {
    if (!auth.token || !auth.orgId || !id) return;
    const next = await api<BoardPayload>(`/v1/projects/${id}/board`, { token: auth.token, orgId: auth.orgId });
    setBoard(next);
  }, [auth.orgId, auth.token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auth.token || !auth.orgId || !id) return;
    const socket = connectRealtime({ token: auth.token, orgId: auth.orgId, projectId: id });
    socketRef.current = socket;
    socket.on("presence.state", (payload: { peers?: PresencePeer[] }) => setPeers(payload.peers ?? []));
    socket.on("comment.created", (row: CollabComment) => {
      setBoard((current) => ({ ...current, comments: [...current.comments.filter((item) => item.id !== row.id), row] }));
    });
    socket.on("comment.updated", (row: CollabComment) => {
      setBoard((current) => ({ ...current, comments: current.comments.map((item) => (item.id === row.id ? row : item)) }));
    });
    socket.on("comment.resolved", (row: CollabComment) => {
      setBoard((current) => ({ ...current, comments: current.comments.map((item) => (item.id === row.id ? row : item)) }));
    });
    socket.on("comment.deleted", (row: { id: string }) => {
      setBoard((current) => ({ ...current, comments: current.comments.filter((item) => item.id !== row.id) }));
    });
    socket.on("task.created", (row: CollabTask) => {
      setBoard((current) => ({ ...current, tasks: [...current.tasks.filter((item) => item.id !== row.id), row] }));
    });
    socket.on("task.updated", (row: CollabTask) => {
      setBoard((current) => ({ ...current, tasks: current.tasks.map((item) => (item.id === row.id ? row : item)) }));
    });
    socket.on("task.deleted", (row: { id: string }) => {
      setBoard((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== row.id) }));
    });
    socket.on("activity.created", (row: CollabActivity) => {
      setBoard((current) => ({ ...current, activity: [row, ...current.activity].slice(0, 40) }));
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [auth.orgId, auth.token, id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !id) return;
    const tick = () => socket.emit("presence.update", { projectId: id, view: view ?? "", item: "" });
    tick();
    const timer = window.setInterval(tick, 20_000);
    return () => window.clearInterval(timer);
  }, [id, view]);

  const people = useMemo(() => {
    const next: Record<string, CollabPerson> = {};
    for (const member of board.members) next[member.id] = member;
    for (const peer of peers) next[peer.userId] ??= { id: peer.userId, name: peer.name };
    if (auth.user) next[auth.user.id] ??= { id: auth.user.id, name: auth.user.name || auth.user.email };
    return next;
  }, [auth.user, board.members, peers]);

  const postComment = useCallback(async (body: string) => {
    if (!auth.token || !id || !target) return;
    await api(`/v1/projects/${id}/comments`, {
      token: auth.token,
      orgId: auth.orgId,
      body: { anchorType: target.anchorType, anchorId: target.anchorId, body },
    });
  }, [auth.orgId, auth.token, id, target]);

  const resolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    if (!auth.token || !id) return;
    await api(`/v1/projects/${id}/comments/${commentId}/${resolved ? "resolve" : "reopen"}`, {
      method: "POST",
      token: auth.token,
      orgId: auth.orgId,
    });
  }, [auth.orgId, auth.token, id]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!auth.token || !id) return;
    await api(`/v1/projects/${id}/comments/${commentId}`, {
      method: "DELETE",
      token: auth.token,
      orgId: auth.orgId,
    });
  }, [auth.orgId, auth.token, id]);

  const addTask = useCallback(async (title: string, assigneeId: string, dueDate: string) => {
    if (!auth.token || !id) return;
    await api(`/v1/projects/${id}/tasks`, {
      token: auth.token,
      orgId: auth.orgId,
      body: { title, assigneeId: assigneeId || null, dueDate: dueDate || null },
    });
  }, [auth.orgId, auth.token, id]);

  const moveTask = useCallback(async (taskId: string, status: CollabTask["status"]) => {
    if (!auth.token || !id) return;
    await api(`/v1/projects/${id}/tasks/${taskId}`, {
      method: "PATCH",
      token: auth.token,
      orgId: auth.orgId,
      body: { status },
    });
  }, [auth.orgId, auth.token, id]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!auth.token || !id) return;
    await api(`/v1/projects/${id}/tasks/${taskId}`, {
      method: "DELETE",
      token: auth.token,
      orgId: auth.orgId,
    });
  }, [auth.orgId, auth.token, id]);

  const value = useMemo<CollabContextValue>(() => ({
    comments: board.comments,
    tasks: board.tasks,
    activity: board.activity,
    members: board.members,
    people,
    peers: peers.filter((peer) => peer.userId !== auth.user?.id),
    target,
    canWrite: canEdit(auth.role),
    canTalk: canComment(auth.role),
    openComments: setTarget,
    closeComments: () => setTarget(null),
    postComment,
    resolveComment,
    deleteComment,
    addTask,
    moveTask,
    deleteTask,
    openCount: (anchorId) => board.comments.filter((row) => row.anchorId === anchorId && !row.resolvedAt).length,
  }), [addTask, auth.role, auth.user?.id, board, deleteComment, deleteTask, moveTask, people, peers, postComment, resolveComment, target]);

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollab(): CollabContextValue {
  const value = useContext(CollabContext);
  if (!value) throw new Error("useCollab must be used within CollabProvider");
  return value;
}

export function useOptionalCollab(): CollabContextValue | null {
  return useContext(CollabContext);
}
