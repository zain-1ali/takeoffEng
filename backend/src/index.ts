import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb } from "./db/connect.js";

setDefaultResultOrder("ipv4first");

const settings = env();
const app = createApp();

await connectDb();
app.listen(settings.PORT, () => {
  console.log(`TakeOff API listening on http://localhost:${settings.PORT}`);
});
