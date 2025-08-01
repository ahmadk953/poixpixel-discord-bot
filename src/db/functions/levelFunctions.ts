import { desc, eq } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
} from '../db.js';
import * as schema from '../schema.js';
import { calculateLevelFromXp } from '@/util/levelingSystem.js';

/**
 * Get user level information or create a new entry if not found
 * @param discordId - Discord ID of the user
 * @returns User level object
 */
export async function getUserLevel(
  discordId: string,
): Promise<schema.levelTableTypes> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get user level');
    }

    const cacheKey = `level-${discordId}`;

    return await withCache<schema.levelTableTypes>(
      cacheKey,
      async () => {
        const level = await db
          .select()
          .from(schema.levelTable)
          .where(eq(schema.levelTable.discordId, discordId))
          .then((rows) => rows[0]);

        if (level) {
          return {
            ...level,
            lastMessageTimestamp: level.lastMessageTimestamp ?? undefined,
          };
        }

        const newLevel: schema.levelTableTypes = {
          discordId,
          xp: 0,
          level: 0,
          lastMessageTimestamp: new Date(),
          messagesSent: 0,
          reactionCount: 0,
        };

        await db.insert(schema.levelTable).values(newLevel);
        return newLevel;
      },
      300,
    );
  } catch (error) {
    return handleDbError('Error getting user level', error as Error);
  }
}

/**
 * Add XP to a user, updating their level if necessary
 * @param discordId - Discord ID of the user
 * @param amount - Amount of XP to add
 */
export async function addXpToUser(
  discordId: string,
  amount: number,
): Promise<{
  leveledUp: boolean;
  newLevel: number;
  oldLevel: number;
  messagesSent: number;
}> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot add xp to user');
    }

    const cacheKey = `level-${discordId}`;
    const userData = await getUserLevel(discordId);
    const currentLevel = userData.level;

    userData.xp = Number(userData.xp ?? 0) + Number(amount);

    userData.lastMessageTimestamp = new Date();
    userData.level = calculateLevelFromXp(userData.xp);
    userData.messagesSent += 1;

    await invalidateLeaderboardCache();
    await invalidateCache(cacheKey);
    await withCache<schema.levelTableTypes>(
      cacheKey,
      async () => {
        const result = await db
          .update(schema.levelTable)
          .set({
            xp: userData.xp,
            level: userData.level,
            lastMessageTimestamp: userData.lastMessageTimestamp,
            messagesSent: userData.messagesSent,
          })
          .where(eq(schema.levelTable.discordId, discordId))
          .returning();

        return result[0] as schema.levelTableTypes;
      },
      300,
    );

    return {
      leveledUp: userData.level > currentLevel,
      newLevel: userData.level,
      oldLevel: currentLevel,
      messagesSent: userData.messagesSent,
    };
  } catch (error) {
    return handleDbError('Error adding XP to user', error as Error);
  }
}

/**
 * Get a user's rank on the XP leaderboard
 * @param discordId - Discord ID of the user
 * @returns User's rank on the leaderboard
 */
export async function getUserRank(discordId: string): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get user rank');
    }

    const leaderboardCache = await getLeaderboardData();

    if (leaderboardCache) {
      const userIndex = leaderboardCache.findIndex(
        (member) => member.discordId === discordId,
      );

      if (userIndex !== -1) {
        return userIndex + 1;
      }
    }

    return 1;
  } catch (error) {
    return handleDbError('Failed to get user rank', error as Error);
  }
}

/**
 * Clear leaderboard cache
 */
export async function invalidateLeaderboardCache(): Promise<void> {
  await invalidateCache('xp-leaderboard');
}

/**
 * Helper function to get or create leaderboard data
 * @returns Array of leaderboard data
 */
async function getLeaderboardData(): Promise<
  Array<{
    discordId: string;
    xp: number;
  }>
> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get leaderboard data');
    }

    const cacheKey = 'xp-leaderboard';
    return withCache<Array<{ discordId: string; xp: number }>>(
      cacheKey,
      async () => {
        return await db
          .select({
            discordId: schema.levelTable.discordId,
            xp: schema.levelTable.xp,
          })
          .from(schema.levelTable)
          .orderBy(desc(schema.levelTable.xp));
      },
      300,
    );
  } catch (error) {
    return handleDbError('Failed to get leaderboard data', error as Error);
  }
}

/**
 * Increments the user's reaction count
 * @param userId - Discord user ID
 * @returns The updated reaction count
 */
export async function incrementUserReactionCount(
  userId: string,
): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error(
        'Database not initialized, cannot increment reaction count',
      );
    }

    const levelData = await getUserLevel(userId);

    const newCount = (levelData.reactionCount || 0) + 1;
    await db
      .update(schema.levelTable)
      .set({ reactionCount: newCount })
      .where(eq(schema.levelTable.discordId, userId));
    await invalidateCache(`level-${userId}`);

    return newCount;
  } catch (error) {
    console.error('Error incrementing user reaction count:', error);
    return 0;
  }
}

/**
 * Decrements the user's reaction count (but not below zero)
 * @param userId - Discord user ID
 * @returns The updated reaction count
 */
export async function decrementUserReactionCount(
  userId: string,
): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error(
        'Database not initialized, cannot increment reaction count',
      );
    }

    const levelData = await getUserLevel(userId);

    const newCount = Math.max(0, levelData.reactionCount - 1);
    await db
      .update(schema.levelTable)
      .set({ reactionCount: newCount < 0 ? 0 : newCount })
      .where(eq(schema.levelTable.discordId, userId));
    await invalidateCache(`level-${userId}`);

    return newCount;
  } catch (error) {
    console.error('Error decrementing user reaction count:', error);
    return 0;
  }
}

/**
 * Gets the user's reaction count
 * @param userId - Discord user ID
 * @returns The user's reaction count
 */
export async function getUserReactionCount(userId: string): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get user reaction count');
    }

    const levelData = await getUserLevel(userId);
    return levelData.reactionCount;
  } catch (error) {
    console.error('Error getting user reaction count:', error);
    return 0;
  }
}

/**
 * Get the XP leaderboard
 * @param limit - Number of entries to return
 * @returns Array of leaderboard entries
 */
export async function getLevelLeaderboard(
  limit = 10,
): Promise<schema.levelTableTypes[]> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get level leaderboard');
    }

    const leaderboardCache = await getLeaderboardData();

    if (leaderboardCache) {
      const limitedCache = leaderboardCache.slice(0, limit);

      const fullLeaderboard = await Promise.all(
        limitedCache.map(async (entry) => {
          const userData = await getUserLevel(entry.discordId);
          return userData;
        }),
      );

      return fullLeaderboard;
    }

    return (await db
      .select()
      .from(schema.levelTable)
      .orderBy(desc(schema.levelTable.xp))
      .limit(limit)) as schema.levelTableTypes[];
  } catch (error) {
    return handleDbError('Failed to get leaderboard', error as Error);
  }
}
