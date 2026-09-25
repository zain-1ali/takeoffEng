import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../common/async-handler.js";
import { forbidden, notFound } from "../common/problem.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg, requireRole } from "../middleware/org.js";
import {
  ANCHOR_TYPES,
  Activity,
  Comment,
  Notification,
  TASK_STATUSES,
  Task,
} from "../models/index.js";
import { requireProject } from "../projects/access.js";
import { commentJson, logActivity, notifyMentions, projectPeople, taskJson } from "./board.js";
import { emitProject } from "./realtime.js";

export const collabRouter = Router({ mergeParams: true });
export const notificationsRouter = Router();

const anchorSchema = z.object({
  anchorType: z.enum(ANCHOR_TYPES).default("PROJECT"),
  anchorId: z.string().trim().min(1).max(80).default("_project"),
});

collabRouter.use(requireAuth, requireOrg, requireProject);

collabRouter.get(
  "/board",
  asyncHandler(async (req, res) => {
    const projectId = req.project!.id;
    const [comments, tasks, activity, members] = await Promise.all([
      Comment.find({ projectId, deletedAt: null }).sort({ createdAt: 1 }).limit(500),
      Task.find({ projectId }).sort({ createdAt: 1 }),
      Activity.find({ projectId }).sort({ createdAt: -1 }).limit(40),
      projectPeople(req.orgId!),
    ]);
    res.json({
      comments: comments.map((row) => commentJson(row)),
      tasks: tasks.map((row) => taskJson(row)),
      activity: activity.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        verb: row.verb,
        text: row.text,
        createdAt: row.createdAt,
      })),
      members,
    });
  }),
);

collabRouter.get(
  "/comments",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { projectId: req.project!.id, deletedAt: null };
    if (typeof req.query.anchorType === "string") filter.anchorType = req.query.anchorType;
    if (typeof req.query.anchorId === "string") filter.anchorId = req.query.anchorId;
    const comments = await Comment.find(filter).sort({ createdAt: 1 }).limit(500);
    res.json({ comments: comments.map((row) => commentJson(row)) });
  }),
);

collabRouter.post(
  "/comments",
  requireRole("COMMENTER"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        ...anchorSchema.shape,
        body: z.string().trim().min(1).max(2000),
      })
      .parse(req.body);
    const comment = await Comment.create({
      projectId: req.project!.id,
      anchorType: body.anchorType,
      anchorId: body.anchorId,
      body: body.body,
      mentions: [],
      authorId: req.userId!,
    });
    const payload = commentJson(comment);
    emitProject(req.project!.id, "comment.created", payload);
    const label = body.anchorType === "PROJECT" ? "the project" : `item ${body.anchorId}`;
    await logActivity(req.project!.id, req.userId!, "commented", `commented on ${label}`, {
      commentId: comment.id,
      anchorId: body.anchorId,
    });
    await notifyMentions({
      orgId: req.orgId!,
      projectId: req.project!.id,
      actorId: req.userId!,
      body: body.body,
      text: `You were mentioned on ${label}`,
    });
    res.status(201).json(payload);
  }),
);

collabRouter.patch(
  "/comments/:commentId",
  requireRole("COMMENTER"),
  asyncHandler(async (req, res) => {
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      projectId: req.project!.id,
      deletedAt: null,
    });
    if (!comment) throw notFound("Comment not found.");
    if (comment.authorId !== req.userId) throw forbidden("You can only edit your own comment.");
    const body = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    comment.body = body.body;
    await comment.save();
    const payload = commentJson(comment);
    emitProject(req.project!.id, "comment.updated", payload);
    res.json(payload);
  }),
);

collabRouter.delete(
  "/comments/:commentId",
  requireRole("COMMENTER"),
  asyncHandler(async (req, res) => {
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      projectId: req.project!.id,
      deletedAt: null,
    });
    if (!comment) throw notFound("Comment not found.");
    if (comment.authorId !== req.userId) throw forbidden("You can only delete your own comment.");
    comment.deletedAt = new Date();
    await comment.save();
    emitProject(req.project!.id, "comment.deleted", { id: comment.id, projectId: req.project!.id });
    res.status(204).end();
  }),
);

collabRouter.post(
  "/comments/:commentId/resolve",
  requireRole("COMMENTER"),
  asyncHandler(async (req, res) => {
    const comment = await toggleResolved(req.project!.id, req.params.commentId!, req.userId!, true);
    res.json(commentJson(comment));
  }),
);

collabRouter.post(
  "/comments/:commentId/reopen",
  requireRole("COMMENTER"),
  asyncHandler(async (req, res) => {
    const comment = await toggleResolved(req.project!.id, req.params.commentId!, req.userId!, false);
    res.json(commentJson(comment));
  }),
);

collabRouter.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const tasks = await Task.find({ projectId: req.project!.id }).sort({ createdAt: 1 });
    res.json({ tasks: tasks.map((row) => taskJson(row)) });
  }),
);

collabRouter.post(
  "/tasks",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).max(200),
        assigneeId: z.string().trim().max(40).optional().nullable(),
        dueDate: z.string().trim().max(20).optional().nullable(),
      })
      .parse(req.body);
    const task = await Task.create({
      projectId: req.project!.id,
      title: body.title,
      assigneeId: body.assigneeId || null,
      dueDate: body.dueDate || null,
      status: "TODO",
      createdById: req.userId!,
    });
    const payload = taskJson(task);
    emitProject(req.project!.id, "task.created", payload);
    await logActivity(req.project!.id, req.userId!, "task_added", `added task “${body.title.slice(0, 50)}”`, {
      taskId: task.id,
    });
    res.status(201).json(payload);
  }),
);

collabRouter.patch(
  "/tasks/:taskId",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.taskId, projectId: req.project!.id });
    if (!task) throw notFound("Task not found.");
    const body = z
      .object({
        title: z.string().trim().min(1).max(200).optional(),
        status: z.enum(TASK_STATUSES).optional(),
        assigneeId: z.string().trim().max(40).optional().nullable(),
        dueDate: z.string().trim().max(20).optional().nullable(),
      })
      .parse(req.body);
    if (body.title) task.title = body.title;
    if (body.status) task.status = body.status;
    if (body.assigneeId !== undefined) task.assigneeId = body.assigneeId;
    if (body.dueDate !== undefined) task.dueDate = body.dueDate;
    await task.save();
    const payload = taskJson(task);
    emitProject(req.project!.id, "task.updated", payload);
    if (body.status) {
      const labels: Record<string, string> = {
        TODO: "to do",
        DOING: "in progress",
        REVIEW: "for review",
        DONE: "done",
      };
      await logActivity(
        req.project!.id,
        req.userId!,
        "task_moved",
        `moved “${task.title.slice(0, 40)}” to ${labels[task.status] ?? task.status}`,
        { taskId: task.id, status: task.status },
      );
    }
    res.json(payload);
  }),
);

collabRouter.delete(
  "/tasks/:taskId",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    const task = await Task.findOneAndDelete({ _id: req.params.taskId, projectId: req.project!.id });
    if (!task) throw notFound("Task not found.");
    emitProject(req.project!.id, "task.deleted", { id: task.id, projectId: req.project!.id });
    res.status(204).end();
  }),
);

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const notes = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(40);
    res.json({
      notifications: notes.map((row) => ({
        id: row.id,
        kind: row.kind,
        text: row.text,
        projectId: row.projectId,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
    });
  }),
);

notificationsRouter.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const note = await Notification.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) throw notFound("Notification not found.");
    note.readAt = new Date();
    await note.save();
    res.json({ id: note.id, readAt: note.readAt });
  }),
);

async function toggleResolved(projectId: string, commentId: string, userId: string, resolved: boolean) {
  const comment = await Comment.findOne({ _id: commentId, projectId, deletedAt: null });
  if (!comment) throw notFound("Comment not found.");
  comment.resolvedAt = resolved ? new Date() : null;
  comment.resolvedById = resolved ? userId : null;
  await comment.save();
  emitProject(projectId, resolved ? "comment.resolved" : "comment.updated", commentJson(comment));
  return comment;
}
