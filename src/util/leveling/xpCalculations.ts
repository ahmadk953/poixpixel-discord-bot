/**
 * Calculates the amount of XP required to reach the given level.
 * Uses the standard XP formula: (5/6) * level * (2 * level^2 + 27 * level + 91)
 * @param level - The level to calculate the XP for
 * @returns - The amount of XP required to reach the given level
 */
export const calculateXpForLevel = (level: number): number => {
  if (level === 0) {
    return 0;
  }
  return Math.round((5 / 6) * level * (2 * level * level + 27 * level + 91));
};

/**
 * Calculates the level that corresponds to the given amount of XP using binary search.
 * @param xp - The amount of XP to calculate the level for
 * @returns - The level that corresponds to the given amount of XP
 */
export const calculateLevelFromXp = (xp: number): number => {
  if (xp < calculateXpForLevel(1)) {
    return 0;
  }

  let low = 1;
  let high = 200;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const xpForMid = calculateXpForLevel(mid);
    const xpForNext = calculateXpForLevel(mid + 1);

    if (xp >= xpForMid && xp < xpForNext) {
      return mid;
    }
    if (xp < xpForMid) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return low - 1;
};

/**
 * Gets the amount of XP required to reach the next level.
 * @param level - The current level
 * @param currentXp - The current amount of XP
 * @returns - The amount of XP required to reach the next level
 */
export const getXpToNextLevel = (level: number, currentXp: number): number => {
  if (level === 0) {
    return calculateXpForLevel(1) - currentXp;
  }

  const nextLevelXp = calculateXpForLevel(level + 1);
  return nextLevelXp - currentXp;
};
