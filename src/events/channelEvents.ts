import { AuditLogEvent, Events, GuildChannel } from 'discord.js';
import logAction from '../util/logging/logAction.js';
import { Event } from '../types/EventTypes.js';

export const channelCreate = {
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

export const channelDelete = {
  name: Events.ChannelDelete,
  execute: async (channel: GuildChannel) => {
    try {
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

export const channelUpdate = {
  name: Events.ChannelUpdate,
  execute: async (oldChannel: GuildChannel, newChannel: GuildChannel) => {
    try {
      const { guild } = newChannel;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      await logAction({
        guild,
        action: 'channelUpdate',
        channel: newChannel,
        moderator,
        oldName: oldChannel.name,
        newName: newChannel.name,
        oldPermissions: oldChannel.permissionOverwrites.cache.first()?.allow,
        newPermissions: newChannel.permissionOverwrites.cache.first()?.allow,
      });
    } catch (error) {
      console.error('Error handling channel update:', error);
    }
  },
};

export default [channelCreate, channelDelete, channelUpdate];
