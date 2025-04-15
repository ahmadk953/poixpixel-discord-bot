import { AuditLogEvent, Events, Role } from 'discord.js';

import { Event } from '@/types/EventTypes.js';
import logAction from '@/util/logging/logAction.js';

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
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.RoleCreate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      await logAction({
        guild,
        action: 'roleCreate',
        role,
        moderator,
      });
    } catch (error) {
      console.error('Error handling role create:', error);
    }
  },
};

export const roleDelete: Event<typeof Events.GuildRoleDelete> = {
  name: Events.GuildRoleDelete,
  execute: async (role: Role) => {
    try {
      const { guild } = role;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.RoleDelete,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      await logAction({
        guild,
        action: 'roleDelete',
        role,
        moderator,
      });
    } catch (error) {
      console.error('Error handling role delete:', error);
    }
  },
};

export const roleUpdate: Event<typeof Events.GuildRoleUpdate> = {
  name: Events.GuildRoleUpdate,
  execute: async (oldRole: Role, newRole: Role) => {
    try {
      const { guild } = newRole;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.RoleUpdate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

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
      console.error('Error handling role update:', error);
    }
  },
};

export default [roleCreate, roleDelete, roleUpdate];
