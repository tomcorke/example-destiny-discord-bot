import Discord from "discord.js";
import express from "express";
import fetch from "isomorphic-fetch";
import https from "https";
import fs from "fs";

import { getDestinyMemberships } from "./bungie";

require("dotenv-safe").config();

const {
  DISCORD_BOT_TOKEN,
  DISCORD_BOT_CLIENT_ID,
  DISCORD_BOT_PERMISSIONS,
  BUNGIE_OAUTH_CLIENT_ID
} = process.env;
const BUNGIE_OAUTH_AUTHORIZE_URL = "https://www.bungie.net/en/OAuth/Authorize";
const BUNGIE_OAUTH_TOKEN_URL =
  "https://www.bungie.net/platform/app/oauth/token/";
const BOT_OAUTH_URL = `https://discordapp.com/api/oauth2/authorize?client_id=${DISCORD_BOT_CLIENT_ID}&permissions=${DISCORD_BOT_PERMISSIONS}&scope=bot`;

const client = new Discord.Client();

const setClientIdle = async () => {
  client.user && (await client.user.setPresence({ game: {}, status: "idle" }));
};

client.on("ready", () => {
  console.log(`Discord client logged in as ${client.user.tag}`);
  console.log(`Add bot to server by visiting ${BOT_OAUTH_URL}`);
});

const COMMAND_PREFIX = "*";

const isCommand = (msg: string, command: string) => {
  return msg.toLowerCase() === `${COMMAND_PREFIX}${command.toLowerCase()}`;
};

client.on("message", msg => {
  if (!msg.content.startsWith(COMMAND_PREFIX)) {
    return;
  }
  const { id, username } = msg.author;
  console.log({ id, username });
  console.log(msg.content);
  if (isCommand(msg.content, "register")) {
    msg.author.send(
      `To register please visit https://localhost:3000/register-start?discordId=${id}`
    );
  }
});

client.login(DISCORD_BOT_TOKEN);

const app = express();

app.use((req, res, next) => {
  console.log(req.url);
  next();
});

app.get("/register-start", (req, res) => {
  const { discordId } = req.query;
  const bungieOauthUrl = `${BUNGIE_OAUTH_AUTHORIZE_URL}?response_type=code&client_id=${BUNGIE_OAUTH_CLIENT_ID}&state=${discordId}`;
  res.redirect(307, bungieOauthUrl);
});

app.get("/register", async (req, res) => {
  const { code, state } = req.query;
  if (code && state && state !== "undefined") {
    try {
      const tokenResponse = await fetch(BUNGIE_OAUTH_TOKEN_URL, {
        body: `grant_type=authorization_code&code=${code}&client_id=${BUNGIE_OAUTH_CLIENT_ID}`,
        cache: "no-cache",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        redirect: "follow",
        referrer: "no-referrer"
      });
      if (tokenResponse.status !== 200) {
        throw Error(
          `Status code ${tokenResponse.status} from bungie token exchange`
        );
      }
      const {
        access_token: accessToken,
        membership_id: bungieMembershipId
      } = await tokenResponse.json();
      const destinyMemberships = await getDestinyMemberships(
        bungieMembershipId,
        accessToken
      );

      if (
        !destinyMemberships.Response ||
        (destinyMemberships.ErrorStatus &&
          destinyMemberships.ErrorStatus !== "Success")
      ) {
        throw Error(
          `Unexpected error status while fetching membership data: ${destinyMemberships.ErrorStatus}`
        );
      }

      const membershipData = destinyMemberships.Response.destinyMemberships;
      return res.json(membershipData);
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

const PORT = process.env.PORT || 3000;

const server = https.createServer(
  {
    key: fs.readFileSync("./localhost-key.pem"),
    cert: fs.readFileSync("./localhost.pem")
  },
  app
);

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

const shutdown = async () => {
  console.log("Shutting down app...");
  await new Promise(resolve => server.close(() => resolve()));
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
