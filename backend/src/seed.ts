import "dotenv/config";
import { createOrganization } from "./orgs/service.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { Membership, User } from "./models/index.js";

async function seedDemo(): Promise<void> {
  await connectDb();
  const owner =
    (await User.findOne({ email: "owner@demo.local" })) ??
    (await User.create({ email: "owner@demo.local", name: "Demo Owner" }));
  const editor =
    (await User.findOne({ email: "editor@demo.local" })) ??
    (await User.create({ email: "editor@demo.local", name: "Demo Editor" }));
  const commenter =
    (await User.findOne({ email: "commenter@demo.local" })) ??
    (await User.create({ email: "commenter@demo.local", name: "Demo Commenter" }));

  let orgId = (await Membership.findOne({ userId: owner.id, role: "OWNER" }))?.orgId;
  if (!orgId) {
    const created = await createOrganization({
      name: "TakeOff Demo",
      ownerId: owner.id,
      plan: "TEAM",
      seats: 5,
    });
    orgId = created.org.id;
  }
  await Membership.updateOne(
    { orgId, userId: editor.id },
    { $setOnInsert: { orgId, userId: editor.id, role: "EDITOR" } },
    { upsert: true },
  );
  await Membership.updateOne(
    { orgId, userId: commenter.id },
    { $setOnInsert: { orgId, userId: commenter.id, role: "COMMENTER" } },
    { upsert: true },
  );
  console.log(`Demo org ${orgId} ready. Users: owner@demo.local, editor@demo.local, commenter@demo.local`);
  await disconnectDb();
}

void seedDemo().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
