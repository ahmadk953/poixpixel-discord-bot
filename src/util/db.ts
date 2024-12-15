import fs from 'node:fs';
import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { memberTable } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const { Pool } = pkg;
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { dbConnectionString } = config;

const dbPool = new Pool({
  connectionString: dbConnectionString,
  ssl: true,
});
const db = drizzle({ client: dbPool });

export async function getAllMembers() {
  return await db.select().from(memberTable);
}

export async function setMembers(nonBotMembers: any) {
  nonBotMembers.forEach(async (member: any) => {
    const memberExists = await db
      .select()
      .from(memberTable)
      .where(eq(memberTable.discordId, member.user.id));
    if (memberExists.length > 0) {
      await db
        .update(memberTable)
        .set({ discordUsername: member.user.username })
        .where(eq(memberTable.discordId, member.user.id));
    }
    else {
      const members: typeof memberTable.$inferInsert = {
        discordId: member.user.id,
        discordUsername: member.user.username,
      };
      await db.insert(memberTable).values(members);
    }
  });
}

export async function removeMember(discordId: string) {
  await db.delete(memberTable).where(eq(memberTable.discordId, discordId));
}

export async function getMember(discordId: string) {
  return await db.select().from(memberTable).where(eq(memberTable.discordId, discordId));
}