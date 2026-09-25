import { User } from "../models/index.js";

export interface PublicPerson {
  id: string;
  name: string;
  email: string;
}

export async function peopleById(ids: Iterable<string>): Promise<Record<string, PublicPerson>> {
  const unique = [...new Set([...ids].filter(Boolean))];
  if (!unique.length) return {};
  const users = await User.find({ _id: { $in: unique }, deletedAt: null })
    .select("name email")
    .lean();
  return Object.fromEntries(
    users.map((user) => [
      user._id,
      {
        id: user._id,
        name: user.name?.trim() || user.email.split("@")[0] || "Member",
        email: user.email,
      },
    ]),
  );
}

export function mentionIds(body: string): string[] {
  return [...body.matchAll(/@([a-zA-Z0-9]{8,})/g)].map((match) => match[1]!);
}
