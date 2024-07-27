import express from "express";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";

import {
  getDestinyMemberships as bungieGetDestinyMemberships,
  getClan,
} from "./bungie";
import { getDiscordUser, saveDestinyMembershipData } from "./discord";

require("dotenv-safe").config();

const { BUNGIE_OAUTH_CLIENT_ID } = process.env;
const BUNGIE_OAUTH_AUTHORIZE_URL = "https://www.bungie.net/en/OAuth/Authorize";
const BUNGIE_OAUTH_TOKEN_URL =
  "https://www.bungie.net/platform/app/oauth/token/";

const app = express();

app.use((req, res, next) => {
  console.log(req.url);
  next();
});

app.get("/register-start", (req, res) => {
  const { discordId } = req.query;
  // Optionally make state more complex than just discord ID, maybe save to a temporary map or something :shrug:
  const bungieOauthUrl = `${BUNGIE_OAUTH_AUTHORIZE_URL}?response_type=code&client_id=${BUNGIE_OAUTH_CLIENT_ID}&state=${discordId}`;
  res.redirect(307, bungieOauthUrl);
});

interface TokenResponseData {
  access_token: string;
  membership_id: string;
}

const getToken = async (authorizationCode: string) => {
  const tokenResponse = await fetch(BUNGIE_OAUTH_TOKEN_URL, {
    body: `grant_type=authorization_code&code=${authorizationCode}&client_id=${BUNGIE_OAUTH_CLIENT_ID}`,
    cache: "no-cache",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    redirect: "follow",
    referrer: "no-referrer",
  });
  if (tokenResponse.status !== 200) {
    throw Error(
      `Status code ${tokenResponse.status} from bungie token exchange`
    );
  }
  return tokenResponse.json() as Promise<TokenResponseData>;
};

const getDestinyMemberships = async (
  bungieMembershipId: string,
  accessToken: string
) => {
  const response = await bungieGetDestinyMemberships(
    bungieMembershipId,
    accessToken
  );
  if (
    !response.Response ||
    (response.ErrorStatus && response.ErrorStatus !== "Success")
  ) {
    throw Error(
      `Unexpected error status while fetching membership data: ${response.ErrorStatus}`
    );
  }
  return response.Response.destinyMemberships;
};

const handleMembershipData = async (
  discordId: string,
  membershipData: GroupUserInfoCard[]
) => {
  // Do something here to associate membership(s) with the discordId in state

  console.log(`Got bungie membership data for discord user ID ${discordId}`);
  const PLATFORMS: { [key: number]: string } = {
    1: "xbox",
    2: "psn",
    3: "steam",
    4: "blizzard",
    5: "stadia",
  };
  const getPlatform = (membershipType: number) =>
    PLATFORMS[membershipType] || "Unknown";

  const discordUser = getDiscordUser(discordId);

  const send = (message: string) => {
    console.log(message);
    discordUser && discordUser.send(message);
  };

  send("Found destiny memberships:");

  await Promise.all(
    membershipData.map(({ membershipType, membershipId, displayName }) => {
      return new Promise<void>(async (resolve) => {
        const clanData = await getClan(membershipType, membershipId);

        send(
          `Platform: ${getPlatform(
            membershipType
          )}, ID: ${membershipId}, displayName: ${displayName}`
        );
        if (clanData.Response.results.length > 0) {
          const clan = clanData.Response.results[0].group;
          send(`Clan: ${clan.name}, ID: ${clan.groupId}`);
        }

        resolve();
      });
    })
  );
};

const getPrimaryDestinyMembership = async (
  membershipData: GroupUserInfoCard[]
) => {
  if (membershipData.length <= 1) {
    return membershipData[0];
  }
  // If there's more than one membership, try to figure out which is
  // the primary (cross-save) membership here, or start doing something
  // more complex to let the user select their platform
  return undefined;
};

app.get("/register", async (req, res) => {
  const { code, state: discordId } = req.query;
  if (
    code &&
    discordId &&
    discordId !== "undefined" &&
    typeof code === "string" &&
    typeof discordId === "string"
  ) {
    try {
      const tokenData = await getToken(code);
      const { access_token: accessToken, membership_id: bungieMembershipId } =
        tokenData;

      const membershipData = await getDestinyMemberships(
        bungieMembershipId,
        accessToken
      );

      await handleMembershipData(discordId, membershipData);

      const primaryDestinyMembership = await getPrimaryDestinyMembership(
        membershipData
      );

      if (primaryDestinyMembership) {
        saveDestinyMembershipData(discordId, {
          membershipType: primaryDestinyMembership.membershipType,
          membershipId: primaryDestinyMembership.membershipId,
          displayName: primaryDestinyMembership.displayName,
        });
      }

      return res.json({
        membershipData,
      });
    } catch (e: any) {
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
