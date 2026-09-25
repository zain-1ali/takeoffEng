/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { CommentButton } from "./CommentButton.js";
import { TeamScreen } from "./TeamScreen.js";

const collab = vi.hoisted(() => ({
  comments: [
    { id: "c1", projectId: "p1", anchorType: "BOQ_ITEM", anchorId: "CPAD", body: "Check qty", authorId: "u1", resolvedAt: null, createdAt: new Date().toISOString() },
  ],
  tasks: [],
  activity: [],
  members: [{ id: "u1", name: "Ada" }],
  people: { u1: { id: "u1", name: "Ada" } },
  peers: [],
  target: null,
  canWrite: true,
  canTalk: true,
  openComments: vi.fn(),
  closeComments: vi.fn(),
  postComment: vi.fn(),
  resolveComment: vi.fn(),
  deleteComment: vi.fn(),
  addTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
  openCount: (anchorId: string) => (anchorId === "CPAD" ? 1 : 0),
}));

vi.mock("../../lib/socket.js", () => ({
  connectRealtime: () => ({ on: vi.fn(), emit: vi.fn(), close: vi.fn() }),
}));

vi.mock("../auth/AuthProvider.js", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Ada", email: "ada@example.com" }, role: "OWNER" }),
}));

vi.mock("../project/ProjectProvider.js", () => ({
  useProject: () => ({
    meta: { id: "p1", name: "Pad take-off" },
    sync: "saved",
    error: null,
    reload: vi.fn(),
    overwriteMine: vi.fn(),
  }),
}));

vi.mock("./CollabProvider.js", () => ({
  useCollab: () => collab,
  useOptionalCollab: () => collab,
}));

describe("team workspace", () => {
  it("shows the team page and opens a bill comment", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TeamScreen />
        <CommentButton code="CPAD" item="A" desc="Concrete in pad footings" />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Team workspace" })).toBeInTheDocument();
    expect(screen.getByText("Pad take-off")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Comments on item A" }));
    expect(collab.openComments).toHaveBeenCalledWith({
      anchorType: "BOQ_ITEM",
      anchorId: "CPAD",
      title: "Item A",
      detail: "Concrete in pad footings",
    });
  });
});
