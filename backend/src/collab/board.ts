import { Activity, Comment, Membership, Notification, Task } from "../models/index.js";
import { emitProject, emitUser } from "./realtime.js";
import { mentionIds, peopleById, type PublicPerson } from "./people.js";

export function commentJson(row: {
  id: string;
  projectId: string;
  anchorType: string;
  anchorId: string;
  body: string;
  mentions?: string[];
  authorId: string;
  resolvedAt?: Date | null;
  resolvedById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    anchorType: row.anchorType,
    anchorId: row.anchorId,
    body: row.body,
    mentions: row.mentions ?? [],
    authorId: row.authorId,
    resolvedAt: row.resolvedAt ?? null,
    resolvedById: row.resolvedById ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function taskJson(row: {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    assigneeId: row.assigneeId ?? null,
    dueDate: row.dueDate ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function logActivity(
  projectId: string,
  actorId: string,
  verb: string,
  text: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const activity = await Activity.create({ projectId, actorId, verb, text, data });
  emitProject(projectId, "activity.created", {
    id: activity.id,
    projectId,
    actorId,
    verb,
    text,
    createdAt: activity.createdAt,
  });
}

export async function notifyMentions(options: {
  orgId: string;
  projectId: string;
  actorId: string;
  body: string;
  text: string;
}): Promise<void> {
  const ids = mentionIds(options.body).filter((id) => id !== options.actorId);
  if (!ids.length) return;
  const members = await Membership.find({ orgId: options.orgId, userId: { $in: ids } }).lean();
  await Promise.all(
    members.map(async (member) => {
      const note = await Notification.create({
        userId: member.userId,
        orgId: options.orgId,
        projectId: options.projectId,
        kind: "mention",
        text: options.text,
        data: { projectId: options.projectId },
      });
      emitUser(member.userId, "notification.created", {
        id: note.id,
        kind: note.kind,
        text: note.text,
        projectId: options.projectId,
        createdAt: note.createdAt,
      });
    }),
  );
}

export async function projectPeople(orgId: string, extraIds: string[] = []): Promise<PublicPerson[]> {
  const members = await Membership.find({ orgId }).lean();
  const people = await peopleById([...members.map((row) => row.userId), ...extraIds]);
  return members.map((row) => ({
    ...(people[row.userId] ?? { id: row.userId, name: "Member", email: "" }),
    role: row.role,
  })) as Array<PublicPerson & { role: string }>;
}
