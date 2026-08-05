import {
  AuditLogEvent,
  ChannelType,
  type DMChannel,
  Events,
  type Guild,
  type GuildChannel,
  type PermissionOverwrites,
  TextChannel,
} from 'discord.js';

import type { Event } from '@/types/EventTypes.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';
import type { ChannelLogAction } from '@/util/logging/types.js';

function arePermissionsEqual(
  oldPerms: Map<string, PermissionOverwrites>,
  newPerms: Map<string, PermissionOverwrites>
): boolean {
  if (oldPerms.size !== newPerms.size) {
    return false;
  }

  for (const [id, oldPerm] of oldPerms.entries()) {
    const newPerm = newPerms.get(id);
    if (!newPerm) {
      return false;
    }

    if (
      !(
        oldPerm.allow.equals(newPerm.allow) && oldPerm.deny.equals(newPerm.deny)
      )
    ) {
      return false;
    }
  }

  return true;
}

function getPermissionTarget(
  id: string,
  perm: PermissionOverwrites,
  guild: Guild
): { targetType: 'role' | 'member'; targetName: string } {
  const targetType = perm.type === 0 ? 'role' : 'member';
  const targetName =
    perm.type === 0
      ? (guild.roles.cache.get(id)?.name ?? id)
      : (guild.members.cache.get(id)?.user.username ?? id);

  return { targetType, targetName };
}

function getPermissionChanges(
  oldChannel: GuildChannel,
  newChannel: GuildChannel
): ChannelLogAction['permissionChanges'] {
  const changes: ChannelLogAction['permissionChanges'] = [];
  const newPerms = newChannel.permissionOverwrites.cache;
  const oldPerms = oldChannel.permissionOverwrites.cache;

  for (const [id, newPerm] of newPerms.entries()) {
    const oldPerm = oldPerms.get(id);
    const { targetType, targetName } = getPermissionTarget(
      id,
      newPerm,
      newChannel.guild
    );

    if (!oldPerm) {
      changes.push({
        action: 'added',
        targetId: id,
        targetType,
        targetName,
        allow: newPerm.allow,
        deny: newPerm.deny,
      });

      continue;
    }

    if (
      oldPerm.allow.equals(newPerm.allow) &&
      oldPerm.deny.equals(newPerm.deny)
    ) {
      continue;
    }

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

  for (const [id, oldPerm] of oldPerms.entries()) {
    if (newPerms.has(id)) {
      continue;
    }

    const { targetType, targetName } = getPermissionTarget(
      id,
      oldPerm,
      oldChannel.guild
    );

    changes.push({
      action: 'removed',
      targetId: id,
      targetType,
      targetName,
      allow: oldPerm.allow,
      deny: oldPerm.deny,
    });
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
        limit: 10,
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
      logger.error('[ChannelEvents] Error handling channel create', error);
    }
  },
};

export const channelDelete: Event<typeof Events.ChannelDelete> = {
  name: Events.ChannelDelete,
  execute: async (channel: GuildChannel | DMChannel) => {
    try {
      if (channel.type === ChannelType.DM) {
        return;
      }

      const { guild } = channel;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 10,
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
      logger.error('[ChannelEvents] Error handling channel delete', error);
    }
  },
};

export const channelUpdate: Event<typeof Events.ChannelUpdate> = {
  name: Events.ChannelUpdate,
  execute: async (
    oldChannel: GuildChannel | DMChannel,
    newChannel: GuildChannel | DMChannel
  ) => {
    try {
      if (
        oldChannel.type === ChannelType.DM ||
        newChannel.type === ChannelType.DM
      ) {
        return;
      }

      const oldSlowmode =
        oldChannel instanceof TextChannel
          ? oldChannel.rateLimitPerUser
          : undefined;
      const newSlowmode =
        newChannel instanceof TextChannel
          ? newChannel.rateLimitPerUser
          : undefined;

      if (
        oldChannel.name === newChannel.name &&
        oldChannel.type === newChannel.type &&
        oldChannel.permissionOverwrites.cache.size ===
          newChannel.permissionOverwrites.cache.size &&
        arePermissionsEqual(
          oldChannel.permissionOverwrites.cache,
          newChannel.permissionOverwrites.cache
        ) &&
        oldSlowmode === newSlowmode &&
        oldChannel.parentId === newChannel.parentId
      ) {
        return;
      }

      const { guild } = newChannel;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 10,
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
        oldSlowmode,
        newSlowmode,
        oldParentId: oldChannel.parentId,
        newParentId: newChannel.parentId,
        permissionChanges:
          (permissionChanges ?? []).length > 0 ? permissionChanges : undefined,
      });
    } catch (error) {
      logger.error('[ChannelEvents] Error handling channel update', error);
    }
  },
};

export default [channelCreate, channelDelete, channelUpdate];
