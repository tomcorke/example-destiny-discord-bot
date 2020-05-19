import { getMembershipDataById } from "bungie-api-ts/user";
import {
  getGroupsForMember,
  GroupType,
  GroupsForMemberFilter,
  getMembersOfGroup,
  RuntimeGroupMemberType
} from "bungie-api-ts/groupv2";
import {
  getProfile,
  DestinyComponentType,
  getDestinyManifest,
  DestinyInventoryItemDefinition,
  DestinyVendorDefinition,
  DestinyRaceDefinition,
  DestinyClassDefinition
} from "bungie-api-ts/destiny2";
import { HttpClientConfig } from "bungie-api-ts/http";
import fetch from "isomorphic-fetch";
import Fuse from "fuse.js";

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
          Object.entries(config.params)
            .map(
              ([key, value]) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(
                  value as string
                )}`
            )
            .join("&")
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

export interface ManifestData {
  [key: string]: any | undefined;
  DestinyInventoryItemDefinition: {
    [key: string]: DestinyInventoryItemDefinition | undefined;
  };
  DestinyVendorDefinition: {
    [key: string]: DestinyVendorDefinition | undefined;
  };
  DestinyRaceDefinition: {
    [key: string]: DestinyRaceDefinition | undefined;
  };
  DestinyClassDefinition: {
    [key: string]: DestinyClassDefinition | undefined;
  };
}
let manifestData: ManifestData | undefined;
let fuseManifestData: any;

export const getManifestData = () => manifestData;

export const getManifest = async () => {
  console.log("Fetching manifest paths...");
  const destinyManifest = await getDestinyManifest(bungieAuthedFetch());
  const path = destinyManifest.Response.jsonWorldContentPaths.en;
  console.log(`Fetching manifest datafrom ${path}...`);
  const manifestDataResponse = await fetch(`https://www.bungie.net${path}`);
  manifestData = await manifestDataResponse.json();
  console.log("Manifest download complete");
  console.log("Preparing manifest data for search...");
  fuseManifestData = new Fuse(
    Object.values(manifestData!.DestinyInventoryItemDefinition),
    {
      shouldSort: true,
      tokenize: true,
      threshold: 0.2,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
      keys: ["displayProperties.name"]
    }
  );
  console.log("Manifest prep complete");
};

export const searchManifestItemDefinitions = async (query: string) => {
  if (!manifestData) {
    return undefined;
  }
  const results = fuseManifestData.search(
    query
  ) as DestinyInventoryItemDefinition[];
  console.log(`Search results for "${query}": ${results.length}`);
  return results[0] as DestinyInventoryItemDefinition | undefined;
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
  membershipType: number | string,
  destinyMembershipId: string,
  withCollectibles: boolean = false
) => {
  return getProfile(bungieAuthedFetch(), {
    membershipType:
      typeof membershipType === "number"
        ? membershipType
        : parseInt(membershipType),
    destinyMembershipId: destinyMembershipId,
    components: [
      DestinyComponentType.Characters,
      DestinyComponentType.Profiles,
      withCollectibles ? DestinyComponentType.Collectibles : 0
    ]
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

export const getClanMembers = async (clanId: string) => {
  return getMembersOfGroup(bungieAuthedFetch(), {
    groupId: clanId,
    currentpage: 1,
    memberType: RuntimeGroupMemberType.None,
    nameSearch: ""
  });
};
