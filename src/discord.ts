import Discord from "discord.js";
import { registerKill, getTotalKillCounts } from "./kill-tracker";

require("dotenv-safe").config();

const {
  DISCORD_BOT_TOKEN,
  DISCORD_BOT_CLIENT_ID,
  DISCORD_BOT_PERMISSIONS,
} = process.env;

const BOT_OAUTH_URL = `https://discordapp.com/api/oauth2/authorize?client_id=${DISCORD_BOT_CLIENT_ID}&permissions=${DISCORD_BOT_PERMISSIONS}&scope=bot`;

const client = new Discord.Client();

export const setClientIdle = async () => {
  client.user && (await client.user.setPresence({ status: "idle" }));
};

client.on("ready", () => {
  console.log(`Discord client logged in as ${client.user?.tag}`);
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

export const getDiscordUser = async (id: string) => {
  return client.users.fetch(id);
};

export const getUserData = (id: string) => getDiscordUser(id);

const getLinkedUserIds = (msg: string) => {
  const userLinks = msg.match(/<@!(\d+)>/g);
  if (userLinks) {
    const userIds = userLinks.map((link) => link.slice(3, -1));
    return userIds;
  }
  return null;
};

client.on("message", async (msg) => {
  if (!msg.content.startsWith(COMMAND_PREFIX)) {
    return;
  }
  const { id, username } = msg.author;

  console.log(`Message from: ${JSON.stringify({ id, username })}`);
  console.log(msg.content);

  if (isCommand(msg.content, "hello")) {
    const userData = await getUserData(id);
    if (userData) {
      msg.reply(`Hello ${userData.username}!`);
    } else {
      msg.reply("Hello stranger!");
    }
  }

  if (
    isCommand(msg.content, "report") ||
    isCommand(msg.content, "kill") ||
    isCommand(msg.content, "killed")
  ) {
    const linkedUserIds = getLinkedUserIds(msg.content);
    if (!linkedUserIds) {
      msg.reply(
        `No users specified - link your victim if you killed someone, or both the killer and victim to report someone else's friendly fire incident.`
      );
      return;
    }
    let killer: string | null = null;
    let victim: string | null = null;
    if (linkedUserIds.length === 1) {
      killer = msg.author.id;
      victim = linkedUserIds[0];
    } else if (linkedUserIds.length === 2) {
      killer = linkedUserIds[0];
      victim = linkedUserIds[1];
    }

    if (killer && victim) {
      const reportMessage = await msg.channel.send(
        `Reporting ultimate betrayal...`
      );

      const killMessage = `<@!${killer}> killed 🔪 💀 <@!${victim}>!`;
      const getBaseRichMessage = () =>
        new Discord.MessageEmbed()
          .setColor("#990000")
          .setTitle("Tarkov Kill Report")
          .setDescription(killMessage);

      const reactionCollector = reportMessage.createReactionCollector(
        (reaction, user) => user.id !== client?.user?.id,
        { time: 600000 }
      );

      let reportResolved = false;

      const resolveReport = async (
        label: string,
        value: string,
        confirmed: boolean = false
      ) => {
        reportResolved = true;
        reactionCollector.stop();
        reportMessage.reactions.removeAll();
        const richMessage = getBaseRichMessage().addField(label, value, false);
        if (confirmed) {
          await registerKill(killer!, victim!);
          const totalKillCounts = await getTotalKillCounts();
          const nonZeroCounts = Object.values(totalKillCounts).filter(
            (value) => value > 0
          );
          const killerKillCount = totalKillCounts[killer!];
          const descendingCounts = nonZeroCounts.sort((a, b) => b - a);
          const rankInCounts =
            descendingCounts.findIndex((count) => count === killerKillCount) +
            1;
          richMessage.addField(
            "Stats",
            `<@!${killer}> has ${totalKillCounts[killer!]} confirmed teamkills.
<@!${killer}> is ranked ${rankInCounts}/${
              nonZeroCounts.length
            } for betraying teammates.`
          );
        }
        await reportMessage.edit("", richMessage);
      };

      const confirmKillByKiller = async () => {
        await resolveReport("Confirmed by:", `<@!${killer}>`, true);
      };
      const confirmKillByVotes = async (users: Discord.ReactionUserManager) => {
        const confirmedUsers = (await users.fetch()).filter(
          (u) => u.id !== client.user?.id
        );
        await resolveReport(
          "Confirmed by:",
          `${confirmedUsers.map((u) => `<@!${u.id}>`).join(", ")}`,
          true
        );
      };
      const confirmKillByNoDispute = async (
        users: Discord.ReactionUserManager | undefined
      ) => {
        if (users) {
          const confirmedUsers = (await users.fetch()).filter(
            (u) => u.id !== client.user?.id
          );
          if (confirmedUsers.size > 0) {
            return await resolveReport(
              "Confirmed by:",
              `${confirmedUsers.map((u) => `<@!${u.id}>`).join(", ")}`,
              true
            );
          }
        }
        await resolveReport("Confirmed by:", "No dispute", true);
      };
      const rejectKillByVictim = async () => {
        await resolveReport("Rejected by:", `<@!${victim}>`);
      };
      const rejectKillByVotes = async (users: Discord.ReactionUserManager) => {
        const rejectedUsers = (await users.fetch()).filter(
          (u) => u.id !== client.user?.id
        );
        await resolveReport(
          "Rejected by:",
          `${rejectedUsers.map((u) => `<@!${u.id}>`).join(", ")}`
        );
      };

      reactionCollector.on("collect", (reaction, user) => {
        if (reaction.emoji.name === "✅") {
          if (user.id === killer) {
            console.log("Kill confirmed by killer");
            return confirmKillByKiller();
          }
          if (reaction.count && reaction.count >= 3) {
            console.log("Kill confirmed by consensus");
            return confirmKillByVotes(reaction.users);
          }
        }
        if (reaction.emoji.name === "❎") {
          if (user.id === victim) {
            console.log("Kill rejected by victim");
            return rejectKillByVictim();
          }
          if (reaction.count && reaction.count >= 3) {
            console.log("Kill rejected by consensus");
            return rejectKillByVotes(reaction.users);
          }
        }
      });

      reactionCollector.on("end", (reactions) => {
        if (!reportResolved) {
          const confirmedReactions = reactions.find(
            (r) => r.emoji.name === "✅"
          );
          const confirmedUsers = confirmedReactions
            ? confirmedReactions.users
            : undefined;
          return confirmKillByNoDispute(confirmedUsers);
        }
      });

      reportMessage.react("✅");
      reportMessage.react("❎");
      await reportMessage.edit(
        getBaseRichMessage().setFooter(
          "Use the reactions below to confirm or dispute this report"
        )
      );
    }
  }
});

client.on("messageReactionAdd", async (channel) => {});

client.login(DISCORD_BOT_TOKEN);
