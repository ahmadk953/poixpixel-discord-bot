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

export const memberRelations = relations(memberTable, ({ many }) => ({
  moderations: many(moderationTable),
}));

export const moderationRelations = relations(moderationTable, ({ one }) => ({
  member: one(memberTable, {
    fields: [moderationTable.discordId],
    references: [memberTable.discordId],
  }),
}));
