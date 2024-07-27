import Discord, { GatewayIntentBits } from "discord.js";
import { BungieMembershipType } from "bungie-api-ts/user";

import { config } from "dotenv-safe";
config();

const { DISCORD_BOT_TOKEN, DISCORD_BOT_CLIENT_ID, DISCORD_BOT_PERMISSIONS } =
  process.env;

const BOT_OAUTH_URL = `https://discordapp.com/api/oauth2/authorize?client_id=${DISCORD_BOT_CLIENT_ID}&permissions=${DISCORD_BOT_PERMISSIONS}&scope=bot`;

const client = new Discord.Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Discord.Partials.Channel, Discord.Partials.Message],
});

export const setClientIdle = async () => {
  client.user && (await client.user.setPresence({ status: "idle" }));
};

client.on("ready", () => {
  console.log(`Discord client logged in as ${client.user?.tag}`);
  console.log(`Add bot to server by visiting ${BOT_OAUTH_URL}`);
});

const COMMAND_PREFIX = "*";

const isCommand = (msg: string, command: string) => {
  return msg.toLowerCase() === `${COMMAND_PREFIX}${command.toLowerCase()}`;
};

export const getDiscordUser = (id: string) => {
  return client.users && client.users.cache.get(id);
};

interface DestinyMembershipData {
  membershipType: BungieMembershipType;
  membershipId: string;
  displayName: string;
}
const discordDestinyMembershipMap = new Map<string, DestinyMembershipData>();
export const saveDestinyMembershipData = (
  discordId: string,
  data: DestinyMembershipData
) => {
  discordDestinyMembershipMap.set(discordId, data);
};
const getDestinyMembershipData = (discordId: string) => {
  return discordDestinyMembershipMap.get(discordId);
};

client.on("messageCreate", (msg) => {
  if (!msg.content.startsWith(COMMAND_PREFIX)) {
    return;
  }
  const { id, username } = msg.author;

  console.log(`Message from: ${JSON.stringify({ id, username })}`);
  console.log(msg.content);

  if (isCommand(msg.content, "hello")) {
    const destinyMembershipData = getDestinyMembershipData(id);
    if (destinyMembershipData) {
      msg.reply(`Hello ${destinyMembershipData.displayName}!`);
    } else {
      msg.reply("Hello stranger!");
    }
  }

  if (isCommand(msg.content, "register")) {
    msg.author.send(
      `To register please visit https://localhost:3000/register-start?discordId=${id}`
    );
  }
});

client.login(DISCORD_BOT_TOKEN);
