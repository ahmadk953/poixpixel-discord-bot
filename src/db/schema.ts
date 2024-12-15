import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';

export const memberTable = pgTable('members', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  discordId: varchar('discord_id').notNull().unique(),
  discordUsername: varchar('discord_username').notNull(),
  numberOfWarnings: integer('number_warnings').notNull().default(0),
  numberOfBans: integer('number_bans').notNull().default(0),
});
