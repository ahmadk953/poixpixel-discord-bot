import { AuditLogEvent, Events, Message } from 'discord.js';
import logAction from '../util/logging/logAction.js';

export const messageDelete = {
  name: Events.MessageDelete,
  execute: async (message: Message) => {
    try {
      if (!message.guild || message.author?.bot) return;

      const { guild } = message;
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      const moderator = executor
        ? await guild.members.fetch(executor.id)
        : undefined;

      await logAction({
        guild,
        action: 'messageDelete',
        message: message as Message<true>,
        moderator,
      });
    } catch (error) {
      console.error('Error handling message delete:', error);
    }
  },
};

export const messageUpdate = {
  name: Events.MessageUpdate,
  execute: async (oldMessage: Message, newMessage: Message) => {
    try {
      if (
        !oldMessage.guild ||
        oldMessage.author?.bot ||
        oldMessage.content === newMessage.content
      ) {
        return;
      }

      await logAction({
        guild: oldMessage.guild,
        action: 'messageEdit',
        message: newMessage as Message<true>,
        oldContent: oldMessage.content ?? '',
        newContent: newMessage.content ?? '',
      });
    } catch (error) {
      console.error('Error handling message update:', error);
    }
  },
};

export default [messageDelete, messageUpdate];
