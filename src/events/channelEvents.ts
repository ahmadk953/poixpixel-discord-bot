import {
  AuditLogEvent,
  ChannelType,
  DMChannel,
  Events,
  GuildChannel,
  PermissionOverwrites,
} from 'discord.js';

import { ChannelLogAction } from '@/util/logging/types.js';
import { Event } from '@/types/EventTypes.js';
import logAction from '@/util/logging/logAction.js';

function arePermissionsEqual(
  oldPerms: Map<string, PermissionOverwrites>,
  newPerms: Map<string, PermissionOverwrites>,
): boolean {
  if (oldPerms.size !== newPerms.size) return false;

  for (const [id, oldPerm] of oldPerms.entries()) {
    const newPerm = newPerms.get(id);
    if (!newPerm) return false;

    if (
      !oldPerm.allow.equals(newPerm.allow) ||
      !oldPerm.deny.equals(newPerm.deny)
    ) {
      return false;
    }
  }

  return true;
}
function getPermissionChanges(
  oldChannel: GuildChannel,
  newChannel: GuildChannel,
): ChannelLogAction['permissionChanges'] {
  const changes: ChannelLogAction['permissionChanges'] = [];
  const newPerms = newChannel.permissionOverwrites.cache;
  const oldPerms = oldChannel.permissionOverwrites.cache;

  for (const [id, newPerm] of newPerms.entries()) {
    const oldPerm = oldPerms.get(id);
    const targetType = newPerm.type === 0 ? 'role' : 'member';
    const targetName =
      newPerm.type === 0
        ? newChannel.guild.roles.cache.get(id)?.name || id
        : newChannel.guild.members.cache.get(id)?.user.username || id;

    if (!oldPerm) {
      changes.push({
        action: 'added',
        targetId: id,
        targetType,
        targetName,
        allow: newPerm.allow,
        deny: newPerm.deny,
      });
    } else if (
      !oldPerm.allow.equals(newPerm.allow) ||
      !oldPerm.deny.equals(newPerm.deny)
    ) {
      changes.push({
        action: 'modified',
        targetId: id,
        targetType,
        targetName,
        oldAllow: oldPerm.allow,
        oldDeny: oldPerm.deny,
        newAllow: newPerm.allow,
        newDeny: newPerm.deny,
      });
    }
  }

  for (const [id, oldPerm] of oldPerms.entries()) {
    if (!newPerms.has(id)) {
      const targetType = oldPerm.type === 0 ? 'role' : 'member';
      const targetName =
        oldPerm.type === 0
          ? oldChannel.guild.roles.cache.get(id)?.name || id
          : oldChannel.guild.members.cache.get(id)?.user.username || id;

      changes.push({
        action: 'removed',
        targetId: id,
        targetType,
        targetName,
        allow: oldPerm.allow,
        deny: oldPerm.deny,
      });
    }
  }

  return changes;
}

export const channelCreate: Event<typeof Events.ChannelCreate> = {
  name: Events.ChannelCreate,
  execute: async (channel: GuildChannel) => {
    try {
      const { guild } = channel;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelCreate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      await logAction({
        guild,
        action: 'channelCreate',
        channel,
        moderator,
      });
    } catch (error) {
      console.error('Error handling channel create:', error);
    }
  },
};

export const channelDelete: Event<typeof Events.ChannelDelete> = {
  name: Events.ChannelDelete,
  execute: async (channel: GuildChannel | DMChannel) => {
    try {
      if (channel.type === ChannelType.DM) return;

      const { guild } = channel;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      await logAction({
        guild,
        action: 'channelDelete',
        channel,
        moderator,
      });
    } catch (error) {
      console.error('Error handling channel delete:', error);
    }
  },
};

export const channelUpdate: Event<typeof Events.ChannelUpdate> = {
  name: Events.ChannelUpdate,
  execute: async (
    oldChannel: GuildChannel | DMChannel,
    newChannel: GuildChannel | DMChannel,
  ) => {
    try {
      if (
        oldChannel.type === ChannelType.DM ||
        newChannel.type === ChannelType.DM
      ) {
        return;
      }
      if (
        oldChannel.name === newChannel.name &&
        oldChannel.type === newChannel.type &&
        oldChannel.permissionOverwrites.cache.size ===
          newChannel.permissionOverwrites.cache.size &&
        arePermissionsEqual(
          oldChannel.permissionOverwrites.cache,
          newChannel.permissionOverwrites.cache,
        ) &&
        oldChannel.position !== newChannel.position
      ) {
        return;
      }

      const { guild } = newChannel;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 1,
      });
      const log = auditLogs.entries.first();
      const executor = log?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      const permissionChanges = getPermissionChanges(oldChannel, newChannel);

      await logAction({
        guild,
        action: 'channelUpdate',
        channel: newChannel,
        moderator,
        oldName: oldChannel.name,
        newName: newChannel.name,
        permissionChanges:
          (permissionChanges ?? []).length > 0 ? permissionChanges : undefined,
      });
    } catch (error) {
      console.error('Error handling channel update:', error);
    }
  },
};

export default [channelCreate, channelDelete, channelUpdate];
