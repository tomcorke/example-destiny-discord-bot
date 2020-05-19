import express from "express";
import fetch from "isomorphic-fetch";

import { getDiscordUser } from "./discord";

require("dotenv-safe").config();

const app = express();

app.use((req, res, next) => {
  console.log(req.url);
  next();
});

app.get("/register", async (req, res) => {
  const { code, state: discordId } = req.query;
  if (code && discordId && discordId !== "undefined") {
    try {
      return res.json({});
    } catch (e) {
      return res
        .status(500)
        .json({ error: `Error handling authentication: ${e.message}` });
    }
  }
  return res
    .status(400)
    .json({ error: "missing code and/or state query parameters" });
});

app.use((req, res) => {
  res.status(404).json({ error: "notfound" });
});

export default app;
