import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachRealtime } from "./collab/realtime.js";
import { env } from "./config/env.js";
import { connectDb } from "./db/connect.js";

const settings = env();
const app = createApp();
const server = createServer(app);
attachRealtime(server);

await connectDb();
server.listen(settings.PORT, () => {
  console.log(`TakeOff API listening on http://localhost:${settings.PORT}`);
});
