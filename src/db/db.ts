import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';

import * as schema from './schema.js';
import { loadConfig } from '../util/configLoader.js';
import { del, exists, getJson, setJson } from './redis.js';

const { Pool } = pkg;
const config = loadConfig();

const dbPool = new Pool({
  connectionString: config.dbConnectionString,
  ssl: true,
});
export const db = drizzle({ client: dbPool, schema });

class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export async function getAllMembers() {
  try {
    if (await exists('nonBotMembers')) {
      const memberData =
        await getJson<(typeof schema.memberTable.$inferSelect)[]>(
          'nonBotMembers',
        );
      if (memberData && memberData.length > 0) {
        return memberData;
      } else {
        await del('nonBotMembers');
        return await getAllMembers();
      }
    } else {
      const nonBotMembers = await db
        .select()
        .from(schema.memberTable)
        .where(eq(schema.memberTable.currentlyInServer, true));
      await setJson<(typeof schema.memberTable.$inferSelect)[]>(
        'nonBotMembers',
        nonBotMembers,
      );
      return nonBotMembers;
    }
  } catch (error) {
    console.error('Error getting all members: ', error);
    throw new DatabaseError('Failed to get all members: ', error as Error);
  }
}

export async function setMembers(nonBotMembers: any) {
  try {
    nonBotMembers.forEach(async (member: any) => {
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
    });
  } catch (error) {
    console.error('Error setting members: ', error);
    throw new DatabaseError('Failed to set members: ', error as Error);
  }
}

export async function getMember(discordId: string) {
  try {
    if (await exists(`${discordId}-memberInfo`)) {
      const cachedMember = await getJson<
        typeof schema.memberTable.$inferSelect
      >(`${discordId}-memberInfo`);
      const cachedModerationHistory = await getJson<
        (typeof schema.moderationTable.$inferSelect)[]
      >(`${discordId}-moderationHistory`);

      if (
        cachedMember &&
        'discordId' in cachedMember &&
        cachedModerationHistory &&
        cachedModerationHistory.length > 0
      ) {
        return {
          ...cachedMember,
          moderations: cachedModerationHistory,
        };
      } else {
        await del(`${discordId}-memberInfo`);
        await del(`${discordId}-moderationHistory`);
        return await getMember(discordId);
      }
    } else {
      const member = await db.query.memberTable.findFirst({
        where: eq(schema.memberTable.discordId, discordId),
        with: {
          moderations: true,
        },
      });

      await setJson<typeof schema.memberTable.$inferSelect>(
        `${discordId}-memberInfo`,
        member!,
      );
      await setJson<(typeof schema.moderationTable.$inferSelect)[]>(
        `${discordId}-moderationHistory`,
        member!.moderations,
      );

      return member;
    }
  } catch (error) {
    console.error('Error getting member: ', error);
    throw new DatabaseError('Failed to get member: ', error as Error);
  }
}

export async function updateMember({
  discordId,
  discordUsername,
  currentlyInServer,
  currentlyBanned,
}: schema.memberTableTypes) {
  try {
    const result = await db
      .update(schema.memberTable)
      .set({
        discordUsername,
        currentlyInServer,
        currentlyBanned,
      })
      .where(eq(schema.memberTable.discordId, discordId));

    if (await exists(`${discordId}-memberInfo`)) {
      await del(`${discordId}-memberInfo`);
    }
    if (await exists('nonBotMembers')) {
      await del('nonBotMembers');
    }

    return result;
  } catch (error) {
    console.error('Error updating member: ', error);
    throw new DatabaseError('Failed to update member: ', error as Error);
  }
}

export async function updateMemberModerationHistory({
  discordId,
  moderatorDiscordId,
  action,
  reason,
  duration,
  createdAt,
  expiresAt,
  active,
}: schema.moderationTableTypes) {
  try {
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
    const result = await db
      .insert(schema.moderationTable)
      .values(moderationEntry);

    if (await exists(`${discordId}-moderationHistory`)) {
      await del(`${discordId}-moderationHistory`);
    }
    if (await exists(`${discordId}-memberInfo`)) {
      await del(`${discordId}-memberInfo`);
    }

    return result;
  } catch (error) {
    console.error('Error updating moderation history: ', error);
    throw new DatabaseError(
      'Failed to update moderation history: ',
      error as Error,
    );
  }
}

export async function getMemberModerationHistory(discordId: string) {
  try {
    if (await exists(`${discordId}-moderationHistory`)) {
      return await getJson<(typeof schema.moderationTable.$inferSelect)[]>(
        `${discordId}-moderationHistory`,
      );
    } else {
      const moderationHistory = await db
        .select()
        .from(schema.moderationTable)
        .where(eq(schema.moderationTable.discordId, discordId));

      await setJson<(typeof schema.moderationTable.$inferSelect)[]>(
        `${discordId}-moderationHistory`,
        moderationHistory,
      );
      return moderationHistory;
    }
  } catch (error) {
    console.error('Error getting moderation history: ', error);
    throw new DatabaseError(
      'Failed to get moderation history: ',
      error as Error,
    );
  }
}

export async function addFact({
  content,
  source,
  addedBy,
  approved = false,
}: schema.factTableTypes) {
  try {
    const result = await db.insert(schema.factTable).values({
      content,
      source,
      addedBy,
      approved,
    });

    await del('unusedFacts');
    return result;
  } catch (error) {
    console.error('Error adding fact:', error);
    throw new DatabaseError('Failed to add fact:', error as Error);
  }
}

export async function getLastInsertedFactId(): Promise<number> {
  try {
    const result = await db
      .select({ id: sql<number>`MAX(${schema.factTable.id})` })
      .from(schema.factTable);

    return result[0]?.id ?? 0;
  } catch (error) {
    console.error('Error getting last inserted fact ID:', error);
    throw new DatabaseError(
      'Failed to get last inserted fact ID:',
      error as Error,
    );
  }
}

export async function getRandomUnusedFact() {
  try {
    if (await exists('unusedFacts')) {
      const facts =
        await getJson<(typeof schema.factTable.$inferSelect)[]>('unusedFacts');
      if (facts && facts.length > 0) {
        return facts[Math.floor(Math.random() * facts.length)];
      }
    }

    const facts = await db
      .select()
      .from(schema.factTable)
      .where(
        and(
          eq(schema.factTable.approved, true),
          isNull(schema.factTable.usedOn),
        ),
      );

    if (facts.length === 0) {
      await db
        .update(schema.factTable)
        .set({ usedOn: null })
        .where(eq(schema.factTable.approved, true));

      return await getRandomUnusedFact();
    }

    await setJson<(typeof schema.factTable.$inferSelect)[]>(
      'unusedFacts',
      facts,
    );
    return facts[Math.floor(Math.random() * facts.length)];
  } catch (error) {
    console.error('Error getting random fact:', error);
    throw new DatabaseError('Failed to get random fact:', error as Error);
  }
}

export async function markFactAsUsed(id: number) {
  try {
    await db
      .update(schema.factTable)
      .set({ usedOn: new Date() })
      .where(eq(schema.factTable.id, id));

    await del('unusedFacts');
  } catch (error) {
    console.error('Error marking fact as used:', error);
    throw new DatabaseError('Failed to mark fact as used:', error as Error);
  }
}

export async function getPendingFacts() {
  try {
    return await db
      .select()
      .from(schema.factTable)
      .where(eq(schema.factTable.approved, false));
  } catch (error) {
    console.error('Error getting pending facts:', error);
    throw new DatabaseError('Failed to get pending facts:', error as Error);
  }
}

export async function approveFact(id: number) {
  try {
    await db
      .update(schema.factTable)
      .set({ approved: true })
      .where(eq(schema.factTable.id, id));

    await del('unusedFacts');
  } catch (error) {
    console.error('Error approving fact:', error);
    throw new DatabaseError('Failed to approve fact:', error as Error);
  }
}

export async function deleteFact(id: number) {
  try {
    await db.delete(schema.factTable).where(eq(schema.factTable.id, id));

    await del('unusedFacts');
  } catch (error) {
    console.error('Error deleting fact:', error);
    throw new DatabaseError('Failed to delete fact:', error as Error);
  }
}
