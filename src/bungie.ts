import { getMembershipDataById } from "bungie-api-ts/user";
import {
  getGroupsForMember,
  GroupType,
  GroupsForMemberFilter
} from "bungie-api-ts/groupv2";
import { getProfile, DestinyComponentType } from "bungie-api-ts/destiny2";
import { HttpClientConfig } from "bungie-api-ts/http";

require("dotenv-safe").config();

const { BUNGIE_API_KEY } = process.env;

const bungieAuthedFetch = (accessToken?: string) => async (
  config: HttpClientConfig
) => {
  try {
    const headers: { [key: string]: string } = {
      "x-api-key": BUNGIE_API_KEY!
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const url = `${config.url}${
      config.params
        ? "?" +
          Object.entries(config.params).map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(
                value as string
              )}`
          )
        : ""
    }`;
    console.log(`Fetching: ${url}`);
    const response = await fetch(url, { headers, credentials: "include" });
    return await response.json();
  } catch (e) {
    console.error(e);
    return {};
  }
};

export const getDestinyMemberships = async (
  bungieMembershipId: string,
  accessToken: string
) => {
  return getMembershipDataById(bungieAuthedFetch(accessToken), {
    membershipId: bungieMembershipId,
    membershipType: 254
  });
};

export const getDestinyProfile = async (
  membershipType: number,
  destinyMembershipId: string
) => {
  return getProfile(bungieAuthedFetch(), {
    membershipType: membershipType,
    destinyMembershipId: destinyMembershipId,
    components: [DestinyComponentType.Characters, DestinyComponentType.Profiles]
  });
};

export const getClan = async (
  membershipType: number,
  destinyMembershipId: string
) => {
  return getGroupsForMember(bungieAuthedFetch(), {
    membershipType: membershipType,
    membershipId: destinyMembershipId,
    groupType: GroupType.Clan,
    filter: GroupsForMemberFilter.All
  });
};
