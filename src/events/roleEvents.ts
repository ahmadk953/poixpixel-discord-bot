import {
  AuditLogEvent,
  Events,
  type Guild,
  type GuildMember,
  type Role,
} from 'discord.js';

import type { Event } from '@/types/EventTypes.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';
import {
  fetchRecentAuditLogEntry,
  type GuildAuditLogsEntry,
} from '@/util/moderationAuditLogs.js';

const resolveModerator = async (
  guild: Guild,
  entry: GuildAuditLogsEntry | undefined
): Promise<GuildMember | undefined> =>
  entry?.executor ? await guild.members.fetch(entry.executor.id) : undefined;

const convertRoleProperties = (role: Role) => ({
  name: role.name,
  color: role.hexColor,
  hoist: role.hoist,
  mentionable: role.mentionable,
});

export const roleCreate: Event<typeof Events.GuildRoleCreate> = {
  name: Events.GuildRoleCreate,
  execute: async (role: Role) => {
    try {
      const { guild } = role;
      const entry = await fetchRecentAuditLogEntry(
        guild,
        AuditLogEvent.RoleCreate,
        role.id
      );
      const moderator = await resolveModerator(guild, entry);

      await logAction({
        guild,
        action: 'roleCreate',
        role,
        moderator,
      });
    } catch (error) {
      logger.error('[RoleEvents] Error handling role create', error);
    }
  },
};

export const roleDelete: Event<typeof Events.GuildRoleDelete> = {
  name: Events.GuildRoleDelete,
  execute: async (role: Role) => {
    try {
      const { guild } = role;
      const entry = await fetchRecentAuditLogEntry(
        guild,
        AuditLogEvent.RoleDelete,
        role.id
      );
      const moderator = await resolveModerator(guild, entry);

      await logAction({
        guild,
        action: 'roleDelete',
        role,
        moderator,
      });
    } catch (error) {
      logger.error('[RoleEvents] Error handling role delete', error);
    }
  },
};

export const roleUpdate: Event<typeof Events.GuildRoleUpdate> = {
  name: Events.GuildRoleUpdate,
  execute: async (oldRole: Role, newRole: Role) => {
    try {
      const { guild } = newRole;
      const entry = await fetchRecentAuditLogEntry(
        guild,
        AuditLogEvent.RoleUpdate,
        newRole.id
      );
      const moderator = await resolveModerator(guild, entry);

      await logAction({
        guild,
        action: 'roleUpdate',
        role: newRole,
        oldRole: convertRoleProperties(oldRole),
        newRole: convertRoleProperties(newRole),
        moderator,
        oldPermissions: oldRole.permissions,
        newPermissions: newRole.permissions,
      });
    } catch (error) {
      logger.error('[RoleEvents] Error handling role update', error);
    }
  },
};

export default [roleCreate, roleDelete, roleUpdate];
