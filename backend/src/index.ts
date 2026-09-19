import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb } from "./db/connect.js";

const settings = env();
const app = createApp();

await connectDb();
app.listen(settings.PORT, () => {
  console.log(`TakeOff API listening on http://localhost:${settings.PORT}`);
});
