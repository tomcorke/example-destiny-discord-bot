import Discord from "discord.js";
import { BungieMembershipType } from "bungie-api-ts/user";
import {
  searchManifestItemDefinitions,
  getClan,
  getClanMembers,
  getDestinyProfile,
  getManifestData
} from "./bungie";
import Bluebird from "bluebird";
import {
  DestinyCharacterComponent,
  DestinyRace,
  DestinyClass
} from "bungie-api-ts/destiny2";

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
  return (
    (msg.split(" ")[0] || "").toLowerCase() ===
    `${COMMAND_PREFIX}${command.toLowerCase()}`
  );
};
const getParams = (msg: string) => {
  return msg.split(" ").slice(1);
};

export const getDiscordUser = (id: string) => {
  return client.users && client.users.get(id);
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

const formatCharacter = (c: DestinyCharacterComponent) => {
  const manifestData = getManifestData();
  if (!manifestData) {
    return `Error: Manifest not loaded`;
  }
  return `${
    manifestData.DestinyRaceDefinition[c.raceHash]!.displayProperties.name
  } ${
    manifestData.DestinyClassDefinition[c.classHash]!.displayProperties.name
  }: ID: ${c.characterId}`;
};

client.on("message", async msg => {
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

  if (msg.content.startsWith("*search")) {
    const query = msg.content
      .split(" ")
      .slice(1)
      .join(" ");
    const result = await searchManifestItemDefinitions(query);
    if (!result) {
      return msg.reply(`No results for "${query}"`);
    }
    const link = `https://destinytracker.com/destiny-2/db/items/${result.hash}`;
    const messageData = `${result.displayProperties.name} - ${result.itemTypeAndTierDisplayName} - ${link}`;
    msg.reply(messageData);
  }

  const replyAsJson = async (msg: Discord.Message, data: any) => {
    const jsonContent = JSON.stringify(data, null, 2).match(
      /((?:.|[\r\n]){1,1500}$)/gm
    );
    jsonContent &&
      (await Bluebird.mapSeries(
        jsonContent,
        async c =>
          await msg.reply(`\`\`\`json
${c}
    \`\`\``)
      ));
  };

  if (isCommand(msg.content, "clanmembers")) {
    const destinyMembershipData = getDestinyMembershipData(id);
    if (!destinyMembershipData) {
      return await msg.reply("Please *register before using this command");
    }
    const clan = await getClan(
      destinyMembershipData.membershipType,
      destinyMembershipData.membershipId
    );
    if (clan && clan.Response && clan.Response.results[0]) {
      const clanData = clan.Response.results[0].group;
      const clanMembers = await getClanMembers(clanData.groupId);
      if (clanMembers && clanMembers.Response && clanMembers.Response.results) {
        await replyAsJson(msg, clanMembers.Response.results);
      }
      console.log(clanMembers);
    }
  }

  if (isCommand(msg.content, "getProfile")) {
    const params = getParams(msg.content);
    const membershipType = params[0];
    const membershipId = params[1];
    const profile = await getDestinyProfile(membershipType, membershipId);
    await replyAsJson(msg, profile);
  }

  if (isCommand(msg.content, "characters")) {
    const params = getParams(msg.content);
    const membershipType = params[0];
    const membershipId = params[1];
    const profile = await getDestinyProfile(membershipType, membershipId);
    if (!profile || !profile.Response) {
      return msg.reply("Could not fetch data");
    }
    const characterIds = profile.Response.profile.data!.characterIds;
    const characters = characterIds.map(
      characterId => profile.Response.characters.data![characterId]
    );
    await Bluebird.mapSeries(
      characters,
      async c => await msg.reply(formatCharacter(c))
    );
  }

  if (isCommand(msg.content, "links")) {
    const params = getParams(msg.content);
    const membershipType = params[0];
    const membershipId = params[1];
    const profile = await getDestinyProfile(membershipType, membershipId);
    if (!profile || !profile.Response) {
      return msg.reply("Could not fetch data");
    }
    const profileData = profile.Response.profile.data;
    const charactersData = profile.Response.characters.data;
    if (!profileData || !charactersData) {
      console.error("No profileData or charactersData in profile response");
      return msg.reply("Could not fetch data");
    }
    const characterIds = profileData.characterIds;
    const characters = characterIds.map(
      characterId => charactersData[characterId]
    );
    const lastPlayedCharacter = characters.sort((a, b) =>
      new Date(a.dateLastPlayed) > new Date(b.dateLastPlayed) ? -1 : 1
    )[0];
    const classMap: { [key: string]: number } = {
      titan: 0,
      hunter: 1,
      warlock: 2
    };
    const classParam = (params[2] || "").toLowerCase();
    const characterFromParam =
      Object.keys(classMap).includes(classParam) &&
      characters.find(c => c.classType === classMap[classParam]);
    let characterToUse = characterFromParam || lastPlayedCharacter;
    if (msg.channel.type === "dm") {
      await msg.reply(
        `I've DM'd you useful links for your ${formatCharacter(characterToUse)}`
      );
    }

    const {
      membershipType: profileMembershipType,
      membershipId: profileMembershipId
    } = profileData.userInfo;

    const membershipTypeMap: { [key: string]: string } = {
      1: "xbox",
      2: "psn",
      3: "pc",
      4: "bnet",
      5: "stadia"
    };

    const messages = [
      `Useful links for: ${formatCharacter(characterToUse)}`,
      `Destiny-power-bars: https://destiny-power-bars.corke.dev`,
      `Braytech: https://braytech.org/${profileMembershipType}/${profileMembershipId}/${characterToUse.characterId}/now`,
      `d2checklist: https://www.d2checklist.com/${profileMembershipType}/${profileMembershipId}/milestones`,
      `raid.report: https://raid.report/${membershipTypeMap[profileMembershipType]}/${profileMembershipId}`
    ];

    await Bluebird.mapSeries(messages, m => msg.reply(m));
  }
});

client.login(DISCORD_BOT_TOKEN);
