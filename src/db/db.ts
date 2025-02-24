import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../util/configLoader.js';

const { Pool } = pkg;
const config = loadConfig();

const dbPool = new Pool({
  connectionString: config.dbConnectionString,
  ssl: true,
});
export const db = drizzle({ client: dbPool, schema });

export async function getAllMembers() {
  return await db
    .select()
    .from(schema.memberTable)
    .where(eq(schema.memberTable.currentlyInServer, true));
}

export async function setMembers(nonBotMembers: any) {
  nonBotMembers.forEach(async (member: any) => {
    const memberExists = await db
      .select()
      .from(schema.memberTable)
      .where(eq(schema.memberTable.discordId, member.user.id));
    if (memberExists.length > 0) {
      await db
        .update(schema.memberTable)
        .set({ discordUsername: member.user.username })
        .where(eq(schema.memberTable.discordId, member.user.id));
    } else {
      const members: typeof schema.memberTable.$inferInsert = {
        discordId: member.user.id,
        discordUsername: member.user.username,
      };
      await db.insert(schema.memberTable).values(members);
    }
  });
}

export async function getMember(discordId: string) {
  return await db.query.memberTable.findFirst({
    where: eq(schema.memberTable.discordId, discordId),
    with: {
      moderations: true,
    },
  });
}

export async function updateMember({
  discordId,
  discordUsername,
  currentlyInServer,
  currentlyBanned,
}: schema.memberTableTypes) {
  return await db
    .update(schema.memberTable)
    .set({
      discordUsername,
      currentlyInServer,
      currentlyBanned,
    })
    .where(eq(schema.memberTable.discordId, discordId));
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
  return await db.insert(schema.moderationTable).values(moderationEntry);
}

export async function getMemberModerationHistory(discordId: string) {
  return await db
    .select()
    .from(schema.moderationTable)
    .where(eq(schema.moderationTable.discordId, discordId));
}
