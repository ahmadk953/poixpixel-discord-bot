import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Collection, GuildMember } from 'discord.js';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import * as schema from './schema.js';
import { loadConfig } from '@/util/configLoader.js';
import { del, exists, getJson, setJson } from './redis.js';
import { calculateLevelFromXp } from '@/util/levelingSystem.js';
import { selectGiveawayWinners } from '@/util/giveaways/giveawayManager.js';
import {
  logManagerNotification,
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';

const { Pool } = pkg;
const config = loadConfig();

// Database connection state
let isDbConnected = false;
let connectionAttempts = 0;
const MAX_DB_RETRY_ATTEMPTS = config.database.maxRetryAttempts;
const INITIAL_DB_RETRY_DELAY = config.database.retryDelay;
let hasNotifiedDbDisconnect = false;
let discordClient: Client | null = null;
let dbPool: pkg.Pool;
export let db: ReturnType<typeof drizzle>;

/**
 * Custom error class for database errors
 */
class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Sets the Discord client for sending notifications
 * @param client - The Discord client
 */
export function setDiscordClient(client: Client): void {
  discordClient = client;
}

/**
 * Initializes the database connection with retry logic
 */
export async function initializeDatabaseConnection(): Promise<boolean> {
  try {
    if (dbPool) {
      try {
        await dbPool.query('SELECT 1');
        isDbConnected = true;
        return true;
      } catch (error) {
        console.warn(
          'Existing database connection is not responsive, creating a new one',
        );
        try {
          await dbPool.end();
        } catch (endError) {
          console.error('Error ending pool:', endError);
        }
      }
    }

    // Log the database connection string (without sensitive info)
    console.log(
      `Connecting to database... (connectionString length: ${config.database.dbConnectionString.length})`,
    );

    dbPool = new Pool({
      connectionString: config.database.dbConnectionString,
      ssl: true,
      connectionTimeoutMillis: 10000,
    });

    await dbPool.query('SELECT 1');

    db = drizzle({ client: dbPool, schema });

    console.info('Successfully connected to database');
    isDbConnected = true;
    connectionAttempts = 0;

    if (hasNotifiedDbDisconnect && discordClient) {
      logManagerNotification(NotificationType.DATABASE_CONNECTION_RESTORED);
      notifyManagers(
        discordClient,
        NotificationType.DATABASE_CONNECTION_RESTORED,
      );
      hasNotifiedDbDisconnect = false;
    }

    return true;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    isDbConnected = false;
    connectionAttempts++;

    if (connectionAttempts >= MAX_DB_RETRY_ATTEMPTS) {
      if (!hasNotifiedDbDisconnect && discordClient) {
        const message = `Failed to connect to database after ${connectionAttempts} attempts.`;
        console.error(message);
        logManagerNotification(
          NotificationType.DATABASE_CONNECTION_LOST,
          `Error: ${error}`,
        );
        notifyManagers(
          discordClient,
          NotificationType.DATABASE_CONNECTION_LOST,
          `Connection attempts exhausted after ${connectionAttempts} tries. The bot cannot function without database access and will now terminate.`,
        );
        hasNotifiedDbDisconnect = true;
      }

      setTimeout(() => {
        console.error('Database connection failed, shutting down bot');
        process.exit(1);
      }, 3000);

      return false;
    }

    // Try to reconnect after delay with exponential backoff
    const delay = Math.min(
      INITIAL_DB_RETRY_DELAY * Math.pow(2, connectionAttempts - 1),
      30000,
    );
    console.log(
      `Retrying database connection in ${delay}ms... (Attempt ${connectionAttempts}/${MAX_DB_RETRY_ATTEMPTS})`,
    );

    setTimeout(initializeDatabaseConnection, delay);

    return false;
  }
}

// Replace existing initialization with a properly awaited one
let dbInitPromise = initializeDatabaseConnection().catch((error) => {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
});

/**
 * Ensures the database is initialized and returns a promise
 * @returns Promise for database initialization
 */
export async function ensureDbInitialized(): Promise<void> {
  await dbInitPromise;

  if (!isDbConnected) {
    dbInitPromise = initializeDatabaseConnection();
    await dbInitPromise;
  }
}

/**
 * Checks if the database connection is active and working
 * @returns Promise resolving to true if connected, false otherwise
 */
export async function ensureDatabaseConnection(): Promise<boolean> {
  await ensureDbInitialized();

  if (!isDbConnected) {
    return await initializeDatabaseConnection();
  }

  try {
    await dbPool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    isDbConnected = false;
    return await initializeDatabaseConnection();
  }
}

// ========================
// Helper functions
// ========================

/**
 * Generic error handler for database operations
 * @param errorMessage - Error message to log
 * @param error - Original error object
 */
export const handleDbError = (errorMessage: string, error: Error): never => {
  console.error(`${errorMessage}:`, error);

  if (
    error.message.includes('connection') ||
    error.message.includes('connect')
  ) {
    isDbConnected = false;
    ensureDatabaseConnection().catch((err) => {
      console.error('Failed to reconnect to database:', err);
    });
  }

  throw new DatabaseError(errorMessage, error);
};

/**
 * Checks and retrieves cached data or fetches from database
 * @param cacheKey - Key to check in cache
 * @param dbFetch - Function to fetch data from database
 * @param ttl - Time to live for cache
 * @returns Cached or fetched data
 */
async function withCache<T>(
  cacheKey: string,
  dbFetch: () => Promise<T>,
  ttl?: number,
): Promise<T> {
  try {
    const cachedData = await getJson<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }
  } catch (error) {
    console.warn(
      `Cache retrieval failed for ${cacheKey}, falling back to database:`,
      error,
    );
  }

  const data = await dbFetch();

  try {
    await setJson(cacheKey, data, ttl);
  } catch (error) {
    console.warn(`Failed to cache data for ${cacheKey}:`, error);
  }

  return data;
}

/**
 * Invalidates a cache key if it exists
 * @param cacheKey - Key to invalidate
 */
async function invalidateCache(cacheKey: string): Promise<void> {
  try {
    if (await exists(cacheKey)) {
      await del(cacheKey);
    }
  } catch (error) {
    console.warn(`Error invalidating cache for key ${cacheKey}:`, error);
  }
}

// ========================
// Member Functions
// ========================

/**
 * Get all non-bot members currently in the server
 * @returns Array of member objects
 */
export async function getAllMembers() {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get members');
    }

    const cacheKey = 'nonBotMembers';
    return await withCache<schema.memberTableTypes[]>(cacheKey, async () => {
      const nonBotMembers = await db
        .select()
        .from(schema.memberTable)
        .where(eq(schema.memberTable.currentlyInServer, true));
      return nonBotMembers;
    });
  } catch (error) {
    return handleDbError('Failed to get all members', error as Error);
  }
}

/**
 * Set or update multiple members at once
 * @param nonBotMembers - Array of member objects
 */
export async function setMembers(
  nonBotMembers: Collection<string, GuildMember>,
): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot set members');
    }

    await Promise.all(
      nonBotMembers.map(async (member) => {
        const memberInfo = await db
          .select()
          .from(schema.memberTable)
          .where(eq(schema.memberTable.discordId, member.user.id));

        if (memberInfo.length > 0) {
          await updateMember({
            discordId: member.user.id,
            discordUsername: member.user.username,
            currentlyInServer: true,
          });
        } else {
          const members: typeof schema.memberTable.$inferInsert = {
            discordId: member.user.id,
            discordUsername: member.user.username,
          };
          await db.insert(schema.memberTable).values(members);
        }
      }),
    );
  } catch (error) {
    handleDbError('Failed to set members', error as Error);
  }
}

/**
 * Get detailed information about a specific member including moderation history
 * @param discordId - Discord ID of the user
 * @returns Member object with moderation history
 */
export async function getMember(
  discordId: string,
): Promise<
  | (schema.memberTableTypes & { moderations: schema.moderationTableTypes[] })
  | undefined
> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get member');
    }

    const cacheKey = `${discordId}-memberInfo`;

    const member = await withCache<schema.memberTableTypes>(
      cacheKey,
      async () => {
        const memberData = await db
          .select()
          .from(schema.memberTable)
          .where(eq(schema.memberTable.discordId, discordId))
          .then((rows) => rows[0]);

        return memberData as schema.memberTableTypes;
      },
    );

    const moderations = await getMemberModerationHistory(discordId);

    return {
      ...member,
      moderations,
    };
  } catch (error) {
    return handleDbError('Failed to get member', error as Error);
  }
}

/**
 * Update a member's information in the database
 * @param discordId - Discord ID of the user
 * @param discordUsername - New username of the member
 * @param currentlyInServer - Whether the member is currently in the server
 * @param currentlyBanned - Whether the member is currently banned
 */
export async function updateMember({
  discordId,
  discordUsername,
  currentlyInServer,
  currentlyBanned,
}: schema.memberTableTypes): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot update member');
    }

    await db
      .update(schema.memberTable)
      .set({
        discordUsername,
        currentlyInServer,
        currentlyBanned,
      })
      .where(eq(schema.memberTable.discordId, discordId));

    await Promise.all([
      invalidateCache(`${discordId}-memberInfo`),
      invalidateCache('nonBotMembers'),
    ]);
  } catch (error) {
    handleDbError('Failed to update member', error as Error);
  }
}

// ========================
// Level & XP Functions
// ========================

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

    return await withCache<schema.levelTableTypes>(cacheKey, async () => {
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
      };

      await db.insert(schema.levelTable).values(newLevel);
      return newLevel;
    });
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

    userData.xp += amount;
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

// ========================
// Moderation Functions
// ========================

/**
 * Add a new moderation action to a member's history
 * @param discordId - Discord ID of the user
 * @param moderatorDiscordId - Discord ID of the moderator
 * @param action - Type of action taken
 * @param reason - Reason for the action
 * @param duration - Duration of the action
 * @param createdAt - Timestamp of when the action was taken
 * @param expiresAt - Timestamp of when the action expires
 * @param active - Wether the action is active or not
 */
export async function updateMemberModerationHistory({
  discordId,
  moderatorDiscordId,
  action,
  reason,
  duration,
  createdAt,
  expiresAt,
  active,
}: schema.moderationTableTypes): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error(
        'Database not initialized, update member moderation history',
      );
    }

    const moderationEntry = {
      discordId,
      moderatorDiscordId,
      action,
      reason,
      duration,
      createdAt,
      expiresAt,
      active,
    };

    await db.insert(schema.moderationTable).values(moderationEntry);

    await Promise.all([
      invalidateCache(`${discordId}-moderationHistory`),
      invalidateCache(`${discordId}-memberInfo`),
    ]);
  } catch (error) {
    handleDbError('Failed to update moderation history', error as Error);
  }
}

/**
 * Get a member's moderation history
 * @param discordId - Discord ID of the user
 * @returns Array of moderation actions
 */
export async function getMemberModerationHistory(
  discordId: string,
): Promise<schema.moderationTableTypes[]> {
  await ensureDbInitialized();

  if (!db) {
    console.error(
      'Database not initialized, cannot get member moderation history',
    );
  }

  const cacheKey = `${discordId}-moderationHistory`;

  try {
    return await withCache<schema.moderationTableTypes[]>(
      cacheKey,
      async () => {
        const history = await db
          .select()
          .from(schema.moderationTable)
          .where(eq(schema.moderationTable.discordId, discordId));
        return history as schema.moderationTableTypes[];
      },
    );
  } catch (error) {
    return handleDbError('Failed to get moderation history', error as Error);
  }
}

// ========================
// Fact Functions
// ========================

/**
 * Add a new fact to the database
 * @param content - Content of the fact
 * @param source - Source of the fact
 * @param addedBy - Discord ID of the user who added the fact
 * @param approved - Whether the fact is approved or not
 */
export async function addFact({
  content,
  source,
  addedBy,
  approved = false,
}: schema.factTableTypes): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot add fact');
    }

    await db.insert(schema.factTable).values({
      content,
      source,
      addedBy,
      approved,
    });

    await invalidateCache('unused-facts');
  } catch (error) {
    handleDbError('Failed to add fact', error as Error);
  }
}

/**
 * Get the ID of the most recently added fact
 * @returns ID of the last inserted fact
 */
export async function getLastInsertedFactId(): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get last inserted fact');
    }

    const result = await db
      .select({ id: sql<number>`MAX(${schema.factTable.id})` })
      .from(schema.factTable);

    return result[0]?.id ?? 0;
  } catch (error) {
    return handleDbError('Failed to get last inserted fact ID', error as Error);
  }
}

/**
 * Get a random fact that hasn't been used yet
 * @returns Random fact object
 */
export async function getRandomUnusedFact(): Promise<schema.factTableTypes> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get random unused fact');
    }

    const cacheKey = 'unused-facts';
    const facts = await withCache<schema.factTableTypes[]>(
      cacheKey,
      async () => {
        return (await db
          .select()
          .from(schema.factTable)
          .where(
            and(
              eq(schema.factTable.approved, true),
              isNull(schema.factTable.usedOn),
            ),
          )) as schema.factTableTypes[];
      },
    );

    if (facts.length === 0) {
      await db
        .update(schema.factTable)
        .set({ usedOn: null })
        .where(eq(schema.factTable.approved, true));

      await invalidateCache(cacheKey);
      return await getRandomUnusedFact();
    }

    return facts[
      Math.floor(Math.random() * facts.length)
    ] as schema.factTableTypes;
  } catch (error) {
    return handleDbError('Failed to get random fact', error as Error);
  }
}

/**
 * Mark a fact as used
 * @param id - ID of the fact to mark as used
 */
export async function markFactAsUsed(id: number): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot mark fact as used');
    }

    await db
      .update(schema.factTable)
      .set({ usedOn: new Date() })
      .where(eq(schema.factTable.id, id));

    await invalidateCache('unused-facts');
  } catch (error) {
    handleDbError('Failed to mark fact as used', error as Error);
  }
}

/**
 * Get all pending facts that need approval
 * @returns Array of pending fact objects
 */
export async function getPendingFacts(): Promise<schema.factTableTypes[]> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get pending facts');
    }

    return (await db
      .select()
      .from(schema.factTable)
      .where(eq(schema.factTable.approved, false))) as schema.factTableTypes[];
  } catch (error) {
    return handleDbError('Failed to get pending facts', error as Error);
  }
}

/**
 * Approve a fact
 * @param id - ID of the fact to approve
 */
export async function approveFact(id: number): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot approve fact');
    }

    await db
      .update(schema.factTable)
      .set({ approved: true })
      .where(eq(schema.factTable.id, id));

    await invalidateCache('unused-facts');
  } catch (error) {
    handleDbError('Failed to approve fact', error as Error);
  }
}

/**
 * Delete a fact
 * @param id - ID of the fact to delete
 */
export async function deleteFact(id: number): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot delete fact');
    }

    await db.delete(schema.factTable).where(eq(schema.factTable.id, id));

    await invalidateCache('unused-facts');
  } catch (error) {
    return handleDbError('Failed to delete fact', error as Error);
  }
}

// ========================
// Giveaway Functions
// ========================

/**
 * Create a giveaway in the database
 * @param giveawayData - Data for the giveaway
 * @returns Created giveaway object
 */
export async function createGiveaway(giveawayData: {
  channelId: string;
  messageId: string;
  endAt: Date;
  prize: string;
  winnerCount: number;
  hostId: string;
  requirements?: {
    level?: number;
    roleId?: string;
    messageCount?: number;
    requireAll?: boolean;
  };
  bonuses?: {
    roles?: Array<{ id: string; entries: number }>;
    levels?: Array<{ threshold: number; entries: number }>;
    messages?: Array<{ threshold: number; entries: number }>;
  };
}): Promise<schema.giveawayTableTypes> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot create giveaway');
    }

    const [giveaway] = await db
      .insert(schema.giveawayTable)
      .values({
        channelId: giveawayData.channelId,
        messageId: giveawayData.messageId,
        endAt: giveawayData.endAt,
        prize: giveawayData.prize,
        winnerCount: giveawayData.winnerCount,
        hostId: giveawayData.hostId,
        requiredLevel: giveawayData.requirements?.level,
        requiredRoleId: giveawayData.requirements?.roleId,
        requiredMessageCount: giveawayData.requirements?.messageCount,
        requireAllCriteria: giveawayData.requirements?.requireAll ?? true,
        bonusEntries:
          giveawayData.bonuses as schema.giveawayTableTypes['bonusEntries'],
      })
      .returning();

    return giveaway as schema.giveawayTableTypes;
  } catch (error) {
    return handleDbError('Failed to create giveaway', error as Error);
  }
}

/**
 * Get a giveaway by ID or message ID
 * @param id - ID of the giveaway
 * @param isDbId - Whether the ID is a database ID
 * @returns Giveaway object or undefined if not found
 */
export async function getGiveaway(
  id: string | number,
  isDbId = false,
): Promise<schema.giveawayTableTypes | undefined> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get giveaway');
      return undefined;
    }

    if (isDbId) {
      const numId = typeof id === 'string' ? parseInt(id) : id;
      const [giveaway] = await db
        .select()
        .from(schema.giveawayTable)
        .where(eq(schema.giveawayTable.id, numId))
        .limit(1);

      return giveaway as schema.giveawayTableTypes;
    } else {
      const [giveaway] = await db
        .select()
        .from(schema.giveawayTable)
        .where(eq(schema.giveawayTable.messageId, id as string))
        .limit(1);

      return giveaway as schema.giveawayTableTypes;
    }
  } catch (error) {
    return handleDbError('Failed to get giveaway', error as Error);
  }
}

/**
 * Get all active giveaways
 * @returns Array of active giveaway objects
 */
export async function getActiveGiveaways(): Promise<
  schema.giveawayTableTypes[]
> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get active giveaways');
    }

    return (await db
      .select()
      .from(schema.giveawayTable)
      .where(
        eq(schema.giveawayTable.status, 'active'),
      )) as schema.giveawayTableTypes[];
  } catch (error) {
    return handleDbError('Failed to get active giveaways', error as Error);
  }
}

/**
 * Update giveaway participants
 * @param messageId - ID of the giveaway message
 * @param userId - ID of the user to add
 * @param entries - Number of entries to add
 * @return 'success' | 'already_entered' | 'inactive' | 'error'
 */
export async function addGiveawayParticipant(
  messageId: string,
  userId: string,
  entries = 1,
): Promise<'success' | 'already_entered' | 'inactive' | 'error'> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot add participant');
      return 'error';
    }

    const giveaway = await getGiveaway(messageId);
    if (!giveaway || giveaway.status !== 'active') {
      return 'inactive';
    }

    if (giveaway.participants?.includes(userId)) {
      return 'already_entered';
    }

    const participants = [...(giveaway.participants || [])];
    for (let i = 0; i < entries; i++) {
      participants.push(userId);
    }

    await db
      .update(schema.giveawayTable)
      .set({ participants: participants })
      .where(eq(schema.giveawayTable.messageId, messageId));

    return 'success';
  } catch (error) {
    handleDbError('Failed to add giveaway participant', error as Error);
    return 'error';
  }
}

/**
 * End a giveaway
 * @param id - ID of the giveaway
 * @param isDbId - Whether the ID is a database ID
 * @param forceWinners - Array of user IDs to force as winners
 * @return Updated giveaway object
 */
export async function endGiveaway(
  id: string | number,
  isDbId = false,
  forceWinners?: string[],
): Promise<schema.giveawayTableTypes | undefined> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot end giveaway');
      return undefined;
    }

    const giveaway = await getGiveaway(id, isDbId);
    if (!giveaway || giveaway.status !== 'active' || !giveaway.participants) {
      return undefined;
    }

    const winners = selectGiveawayWinners(
      giveaway.participants,
      giveaway.winnerCount,
      forceWinners,
    );

    const [updatedGiveaway] = await db
      .update(schema.giveawayTable)
      .set({
        status: 'ended',
        winnersIds: winners,
      })
      .where(eq(schema.giveawayTable.id, giveaway.id))
      .returning();

    return updatedGiveaway as schema.giveawayTableTypes;
  } catch (error) {
    return handleDbError('Failed to end giveaway', error as Error);
  }
}

/**
 * Reroll winners for a giveaway
 * @param id - ID of the giveaway
 * @return Updated giveaway object
 */
export async function rerollGiveaway(
  id: string,
): Promise<schema.giveawayTableTypes | undefined> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot reroll giveaway');
      return undefined;
    }

    const giveaway = await getGiveaway(id, true);
    if (
      !giveaway ||
      !giveaway.participants ||
      giveaway.participants.length === 0 ||
      giveaway.status !== 'ended'
    ) {
      console.warn(
        `Cannot reroll giveaway ${id}: Not found, no participants, or not ended.`,
      );
      return undefined;
    }

    const newWinners = selectGiveawayWinners(
      giveaway.participants,
      giveaway.winnerCount,
      undefined,
      giveaway.winnersIds ?? [],
    );

    if (newWinners.length === 0) {
      console.warn(
        `Cannot reroll giveaway ${id}: No eligible participants left after excluding previous winners.`,
      );
      return giveaway;
    }

    const [updatedGiveaway] = await db
      .update(schema.giveawayTable)
      .set({
        winnersIds: newWinners,
      })
      .where(eq(schema.giveawayTable.id, giveaway.id))
      .returning();

    return updatedGiveaway as schema.giveawayTableTypes;
  } catch (error) {
    return handleDbError('Failed to reroll giveaway', error as Error);
  }
}
