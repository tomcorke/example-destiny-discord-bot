// kills by killer, victim, timestamp

const kills = new Map<string, Map<string, number[]>>();

const getKillerKills = (killerId: string) => {
  const existingKillerKills = kills.get(killerId);
  if (existingKillerKills) {
    return existingKillerKills;
  }
  const newKillerKills = new Map<string, number[]>();
  kills.set(killerId, newKillerKills);
  return newKillerKills;
};

const getVictimKills = (
  killerKills: Map<string, number[]>,
  victimId: string
) => {
  const existingVictimKills = killerKills.get(victimId);
  if (existingVictimKills) {
    return existingVictimKills;
  }
  const newVictimKills: number[] = [];
  killerKills.set(victimId, newVictimKills);
  return newVictimKills;
};

export const registerKill = async (killerId: string, victimId: string) => {
  const now = Date.now();
  const killerKills = getKillerKills(killerId);
  const victimKills = getVictimKills(killerKills, victimId);
  victimKills.push(now);
  return killerKills;
};

export const getKills = async (killerId: string) => {
  return getKillerKills(killerId);
};

export const getTotalKillCounts = async () => {
  return Array.from(kills.entries()).reduce(
    (summary, [id, victims]) => ({
      ...summary,
      [id]: Array.from(victims.values()).reduce(
        (sum, kills) => sum + kills.length,
        0
      ),
    }),
    {} as { [killerId: string]: number }
  );
};
