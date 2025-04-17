import { Collection, GuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
} from '../db.js';
import * as schema from '../schema.js';
import { getMemberModerationHistory } from './moderationFunctions.js';

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
  currentlyMuted,
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
        currentlyMuted,
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
