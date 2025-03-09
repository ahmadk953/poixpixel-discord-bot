import {
  boolean,
  integer,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export interface memberTableTypes {
  id?: number;
  discordId: string;
  discordUsername?: string;
  currentlyInServer?: boolean;
  currentlyBanned?: boolean;
  currentlyMuted?: boolean;
}

export const memberTable = pgTable('members', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  discordId: varchar('discord_id').notNull().unique(),
  discordUsername: varchar('discord_username').notNull(),
  currentlyInServer: boolean('currently_in_server').notNull().default(true),
  currentlyBanned: boolean('currently_banned').notNull().default(false),
  currentlyMuted: boolean('currently_muted').notNull().default(false),
});

export interface levelTableTypes {
  id?: number;
  discordId: string;
  xp: number;
  level: number;
  lastMessageTimestamp?: Date;
}

export const levelTable = pgTable('levels', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  discordId: varchar('discord_id')
    .notNull()
    .references(() => memberTable.discordId, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  lastMessageTimestamp: timestamp('last_message_timestamp'),
});

export interface moderationTableTypes {
  id?: number;
  discordId: string;
  moderatorDiscordId: string;
  action: 'warning' | 'mute' | 'kick' | 'ban';
  reason: string;
  duration: string;
  createdAt?: Date;
  expiresAt?: Date;
  active?: boolean;
}

export const moderationTable = pgTable('moderations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  discordId: varchar('discord_id')
    .notNull()
    .references(() => memberTable.discordId, { onDelete: 'cascade' }),
  moderatorDiscordId: varchar('moderator_discord_id').notNull(),
  action: varchar('action').notNull(),
  reason: varchar('reason').notNull().default(''),
  duration: varchar('duration').default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  active: boolean('active').notNull().default(true),
});

export const memberRelations = relations(memberTable, ({ many, one }) => ({
  moderations: many(moderationTable),
  levels: one(levelTable, {
    fields: [memberTable.discordId],
    references: [levelTable.discordId],
  }),
}));

export const levelRelations = relations(levelTable, ({ one }) => ({
  member: one(memberTable, {
    fields: [levelTable.discordId],
    references: [memberTable.discordId],
  }),
}));

export const moderationRelations = relations(moderationTable, ({ one }) => ({
  member: one(memberTable, {
    fields: [moderationTable.discordId],
    references: [memberTable.discordId],
  }),
}));

export type factTableTypes = {
  id?: number;
  content: string;
  source?: string;
  addedBy: string;
  addedAt?: Date;
  approved?: boolean;
  usedOn?: Date;
};

export const factTable = pgTable('facts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  content: varchar('content').notNull(),
  source: varchar('source'),
  addedBy: varchar('added_by').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  approved: boolean('approved').default(false).notNull(),
  usedOn: timestamp('used_on'),
});
