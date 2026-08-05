import {
  AuditLogEvent,
  Events,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';

import {
  db,
  ensureDbInitialized,
  updateMember,
  updateMemberModerationHistory,
} from '@/db/db.js';
import { memberTable } from '@/db/schema.js';
import type { Event } from '@/types/EventTypes.js';
import {
  executeUnban,
  executeUnmute,
  formatDuration,
  scheduleUnmute,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';
import {
  fetchRecentAuditLogEntry,
  isAuditLogEntryByBot,
} from '@/util/moderationAuditLogs.js';

/**
 * Ensures a user record exists in the member table before inserting moderation history.
 * Required because moderationTable has a FK constraint on memberTable.discordId.
 */
async function ensureMemberInDb(user: {
  id: string;
  username?: string | null;
}): Promise<void> {
  try {
    await ensureDbInitialized();
    if (!db) {
      return;
    }

    await db
      .insert(memberTable)
      .values({
        discordId: user.id,
        discordUsername: user.username ?? user.id,
        currentlyInServer: false,
      })
      .onConflictDoNothing();
  } catch (error) {
    logger.warn(
      '[ModerationEvents] Failed to upsert member before recording moderation history',
      error
    );
  }
}

/**
 * Handles the GuildBanAdd event.
 * Detects if the ban was performed externally, records it in the database, and logs it.
 */
export const guildBanAdd: Event<typeof Events.GuildBanAdd> = {
  name: Events.GuildBanAdd,
  execute: async (ban) => {
    try {
      const { guild, user } = ban;
      if (!(guild && user)) {
        return;
      }

      const entry = await fetchRecentAuditLogEntry(
        guild,
        AuditLogEvent.MemberBanAdd,
        user.id
      );
      const executor = entry?.executor;

      if (!executor || isAuditLogEntryByBot(entry, guild.client.user?.id)) {
        return;
      }

      const reason = entry.reason ?? 'No reason provided';

      await ensureMemberInDb(user);

      await Promise.all([
        updateMemberModerationHistory({
          discordId: user.id,
          moderatorDiscordId: executor.id,
          action: 'ban',
          reason,
          duration: 'indefinite',
          createdAt: new Date(),
          active: true,
        }),
        updateMember({
          discordId: user.id,
          currentlyBanned: true,
          currentlyInServer: false,
        }),
        logAction({
          guild,
          action: 'ban',
          target: user,
          moderator: executor,
          reason,
        }),
      ]);
    } catch (error) {
      logger.error('[ModerationEvents] Error handling guild ban add', error);
    }
  },
};

/**
 * Handles the GuildBanRemove event.
 * Detects if the unban was performed externally, updates the database, and logs it.
 */
export const guildBanRemove: Event<typeof Events.GuildBanRemove> = {
  name: Events.GuildBanRemove,
  execute: async (ban) => {
    try {
      const { guild, user } = ban;
      if (!(guild && user)) {
        return;
      }

      const entry = await fetchRecentAuditLogEntry(
        guild,
        AuditLogEvent.MemberBanRemove,
        user.id
      );
      const executor = entry?.executor;

      if (!executor || isAuditLogEntryByBot(entry, guild.client.user?.id)) {
        return;
      }

      const reason = entry.reason ?? 'No reason provided';

      await Promise.all([
        executeUnban(guild.client, guild.id, user.id, reason, true, true),
        logAction({
          guild,
          action: 'unban',
          target: user,
          moderator: executor,
          reason,
        }),
      ]);
    } catch (error) {
      logger.error('[ModerationEvents] Error handling guild ban remove', error);
    }
  },
};

/**
 * Handles the GuildMemberRemove event to detect external kicks.
 * Detects if the kick was performed externally, records it in the database, and logs it.
 */
export const guildMemberKick: Event<typeof Events.GuildMemberRemove> = {
  name: Events.GuildMemberRemove,
  execute: async (member) => {
    try {
      const { guild, user } = member;
      if (!(guild && user)) {
        return;
      }

      const entry = await fetchRecentAuditLogEntry(
        guild,
        AuditLogEvent.MemberKick,
        user.id
      );
      const executor = entry?.executor;

      if (!executor || isAuditLogEntryByBot(entry, guild.client.user?.id)) {
        return;
      }

      const reason = entry.reason ?? 'No reason provided';

      await ensureMemberInDb(user);

      await Promise.all([
        updateMemberModerationHistory({
          discordId: user.id,
          moderatorDiscordId: executor.id,
          action: 'kick',
          reason,
          duration: '',
          createdAt: new Date(),
        }),
        logAction({
          guild,
          action: 'kick',
          target: user,
          moderator: executor,
          reason,
        }),
      ]);
    } catch (error) {
      logger.error(
        '[ModerationEvents] Error handling guild member kick',
        error
      );
    }
  },
};

/**
 * Handles when a timeout (mute) is added or extended externally.
 * Records the mute in the database and logs it.
 */
async function timeoutAdd(
  _oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  const { guild } = newMember;
  const newTimeout = newMember.communicationDisabledUntilTimestamp;

  const entry = await fetchRecentAuditLogEntry(
    guild,
    AuditLogEvent.MemberUpdate,
    newMember.user.id,
    (logEntry) =>
      logEntry.changes?.some(
        (change: { key: string }) =>
          change.key === 'communication_disabled_until'
      ) ?? false
  );

  if (!entry) {
    return;
  }

  const executor = entry.executor;

  if (!executor || isAuditLogEntryByBot(entry, guild.client.user?.id)) {
    return;
  }

  const durationMs = (newTimeout ?? Date.now()) - Date.now();
  const durationStr = formatDuration(durationMs);
  const expiresAt = newTimeout ? new Date(newTimeout) : undefined;
  const reason = entry.reason ?? 'No reason provided';

  await Promise.all([
    updateMemberModerationHistory({
      discordId: newMember.user.id,
      moderatorDiscordId: executor.id,
      action: 'mute',
      reason,
      duration: durationStr,
      createdAt: new Date(),
      expiresAt,
      active: true,
    }),
    updateMember({
      discordId: newMember.user.id,
      currentlyMuted: true,
    }),
    logAction({
      guild,
      action: 'mute',
      target: newMember,
      moderator: executor,
      reason,
      duration: durationStr,
    }),
  ]);

  if (expiresAt) {
    await scheduleUnmute(
      newMember.client,
      guild.id,
      newMember.user.id,
      expiresAt
    );
  }
}

/**
 * Handles when a timeout (mute) is removed externally.
 * Logs the action and syncs the database via executeUnmute.
 */
async function timeoutRemove(
  _oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  const { guild } = newMember;

  const entry = await fetchRecentAuditLogEntry(
    guild,
    AuditLogEvent.MemberUpdate,
    newMember.user.id,
    (logEntry) =>
      logEntry.changes?.some(
        (change: { key: string; new?: unknown }) =>
          change.key === 'communication_disabled_until' && !change.new
      ) ?? false
  );

  if (!entry) {
    return;
  }

  const executor = entry.executor;

  if (!executor || isAuditLogEntryByBot(entry, guild.client.user?.id)) {
    return;
  }

  await executeUnmute(
    newMember.client,
    guild.id,
    newMember.user.id,
    entry.reason ?? 'Untimed out externally',
    undefined,
    true,
    true
  );

  await logAction({
    guild,
    action: 'unmute',
    target: newMember,
    moderator: executor,
    reason: entry.reason ?? 'No reason provided',
  });
}

/**
 * Handles the GuildMemberUpdate event to detect timeouts (mutes) and untimeouts (unmutes).
 * Detects if the action was performed externally and logs it.
 */
export const guildMemberTimeout: Event<typeof Events.GuildMemberUpdate> = {
  name: Events.GuildMemberUpdate,
  execute: async (oldMember, newMember) => {
    try {
      const { guild } = newMember;
      if (!guild) {
        return;
      }

      const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
      const newTimeout = newMember.communicationDisabledUntilTimestamp;
      const timeoutChanged = oldTimeout !== newTimeout;

      if (!timeoutChanged) {
        return;
      }

      if (newTimeout && newTimeout > Date.now()) {
        await timeoutAdd(oldMember, newMember);
      } else if (oldTimeout && oldTimeout > Date.now() && !newTimeout) {
        await timeoutRemove(oldMember, newMember);
      }
    } catch (error) {
      logger.error(
        '[ModerationEvents] Error handling guild member timeout',
        error
      );
    }
  },
};

export default [
  guildBanAdd,
  guildBanRemove,
  guildMemberKick,
  guildMemberTimeout,
];
