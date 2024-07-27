import https from "https";
import fs from "fs";

import { setClientIdle } from "./discord.js";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

const server = https.createServer(
  {
    key: fs.readFileSync("./localhost-key.pem"),
    cert: fs.readFileSync("./localhost.pem"),
  },
  app
);

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

const shutdown = async () => {
  console.log("Shutting down app...");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log("Setting bot status to idle...");
  await setClientIdle();
};
process.on("SIGINT", async () => {
  await shutdown();
  process.exit();
});
process.once("SIGUSR2", async () => {
  await shutdown();
  process.kill(process.pid, "SIGUSR2");
});
