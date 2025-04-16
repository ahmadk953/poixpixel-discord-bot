import {
  boolean,
  integer,
  json,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, relations } from 'drizzle-orm';

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
  messagesSent: number;
  reactionCount: number;
  lastMessageTimestamp?: Date;
}

export const levelTable = pgTable('levels', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  discordId: varchar('discord_id')
    .notNull()
    .references(() => memberTable.discordId, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(0),
  messagesSent: integer('messages_sent').notNull().default(0),
  reactionCount: integer('reaction_count').notNull().default(0),
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
  facts: many(factTable),
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

export type giveawayTableTypes = InferSelectModel<typeof giveawayTable> & {
  bonusEntries: {
    roles?: Array<{ id: string; entries: number }>;
    levels?: Array<{ threshold: number; entries: number }>;
    messages?: Array<{ threshold: number; entries: number }>;
  };
};

export const giveawayTable = pgTable('giveaways', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  channelId: varchar('channel_id').notNull(),
  messageId: varchar('message_id').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  endAt: timestamp('end_at').notNull(),
  prize: varchar('prize').notNull(),
  winnerCount: integer('winner_count').notNull().default(1),
  hostId: varchar('host_id')
    .references(() => memberTable.discordId)
    .notNull(),
  status: varchar('status').notNull().default('active'),
  participants: varchar('participants').array().default([]),
  winnersIds: varchar('winners_ids').array().default([]),
  requiredLevel: integer('required_level'),
  requiredRoleId: varchar('required_role_id'),
  requiredMessageCount: integer('required_message_count'),
  requireAllCriteria: boolean('require_all_criteria').default(true),
  bonusEntries: jsonb('bonus_entries').default({}),
});

export type userAchievementsTableTypes = InferSelectModel<
  typeof userAchievementsTable
>;

export const userAchievementsTable = pgTable('user_achievements', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  discordId: varchar('user_id', { length: 50 })
    .notNull()
    .references(() => memberTable.discordId),
  achievementId: integer('achievement_id')
    .notNull()
    .references(() => achievementDefinitionsTable.id),
  earnedAt: timestamp('earned_at'),
  progress: integer().default(0),
});

export type achievementDefinitionsTableTypes = InferSelectModel<
  typeof achievementDefinitionsTable
>;

export const achievementDefinitionsTable = pgTable('achievement_definitions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }).notNull(),
  imageUrl: varchar('image_url', { length: 255 }),
  requirement: json().notNull(),
  requirementType: varchar('requirement_type', { length: 50 }).notNull(),
  threshold: integer().notNull(),
  rewardType: varchar('reward_type', { length: 50 }),
  rewardValue: varchar('reward_value', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
