import Discord from "discord.js";

require("dotenv-safe").config();

const {
  DISCORD_BOT_TOKEN,
  DISCORD_BOT_CLIENT_ID,
  DISCORD_BOT_PERMISSIONS
} = process.env;

const BOT_OAUTH_URL = `https://discordapp.com/api/oauth2/authorize?client_id=${DISCORD_BOT_CLIENT_ID}&permissions=${DISCORD_BOT_PERMISSIONS}&scope=bot`;

const client = new Discord.Client();

export const setClientIdle = async () => {
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

const discordUserMap = new Map<string, Discord.User>();
const discordUserTimeoutMap = new Map<string, NodeJS.Timeout>();
const temporarilyCacheDiscordUser = (id: string, user: Discord.User) => {
  console.log(`Temporarily storing discord user to cache with ID: ${id}`);
  discordUserMap.set(id, user);
  // Forget user in 5 minutes
  const existingTimeout = discordUserTimeoutMap.get(id);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  const newTimeout = setTimeout(() => {
    console.log(`Expiring discord user ID in cache: ${id}`);
    discordUserMap.delete(id);
  }, 5 * 60 * 1000);
  discordUserTimeoutMap.set(id, newTimeout);
};

export const getDiscordUser = (id: string) => {
  console.log(`Looking for discord user id in cache: ${id}`);
  const result = discordUserMap.get(id);
  !!result ? console.log("Found user!") : console.log("Could not find user");
  return result || (client.users && client.users.get(id));
};

client.on("message", msg => {
  if (!msg.content.startsWith(COMMAND_PREFIX)) {
    return;
  }
  const { id, username } = msg.author;
  console.log({ id, username });
  console.log(msg.content);
  if (isCommand(msg.content, "register")) {
    temporarilyCacheDiscordUser(id, msg.author);
    msg.author.send(
      `To register please visit https://localhost:3000/register-start?discordId=${id}`
    );
  }
});

client.login(DISCORD_BOT_TOKEN);
