import { AuditLogEvent, Events, Message, PartialMessage } from 'discord.js';

import { Event } from '@/types/EventTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import {
  addCountingReactions,
  processCountingMessage,
  resetCounting,
} from '@/util/countingManager.js';
import logAction from '@/util/logging/logAction.js';
import {
  checkAndAssignLevelRoles,
  processMessage,
} from '@/util/levelingSystem.js';

export const messageDelete: Event<typeof Events.MessageDelete> = {
  name: Events.MessageDelete,
  execute: async (
    message: Omit<Partial<Message<boolean> | PartialMessage>, 'channel'>,
  ) => {
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

export const messageUpdate: Event<typeof Events.MessageUpdate> = {
  name: Events.MessageUpdate,
  execute: async (
    oldMessage: Omit<Partial<Message<boolean> | PartialMessage>, 'channel'>,
    newMessage: Message,
  ) => {
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

export const messageCreate: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  execute: async (message: Message) => {
    try {
      if (message.author.bot || !message.guild) return;

      const levelResult = await processMessage(message);
      const advancementsChannelId = loadConfig().channels.advancements;
      const advancementsChannel = message.guild?.channels.cache.get(
        advancementsChannelId,
      );

      if (!advancementsChannel?.isTextBased()) {
        console.error(
          'Advancements channel not found or is not a text channel',
        );
        return;
      }

      if (levelResult?.leveledUp) {
        await advancementsChannel.send(
          `🎉 Congratulations <@${message.author.id}>! You've leveled up to **Level ${levelResult.newLevel}**!`,
        );

        const assignedRole = await checkAndAssignLevelRoles(
          message.guild,
          message.author.id,
          levelResult.newLevel,
        );

        if (assignedRole) {
          await advancementsChannel.send(
            `<@${message.author.id}> You've earned the <@&${assignedRole}> role!`,
          );
        }
      }

      const countingChannelId = loadConfig().channels.counting;
      const countingChannel =
        message.guild?.channels.cache.get(countingChannelId);

      if (!countingChannel || message.channel.id !== countingChannelId) return;
      if (!countingChannel.isTextBased()) {
        console.error('Counting channel not found or is not a text channel');
        return;
      }

      const result = await processCountingMessage(message);

      if (result.isValid) {
        await addCountingReactions(message, result.milestoneType || 'normal');
      } else {
        let errorMessage: string;

        switch (result.reason) {
          case 'not_a_number':
            errorMessage = `${message.author}, that's not a valid number! The count has been reset. The next number should be **1**.`;
            break;
          case 'too_high':
            errorMessage = `${message.author}, too high! The count was **${(result?.expectedCount ?? 0) - 1}** and the next number should have been **${result.expectedCount}**. The count has been reset.`;
            break;
          case 'too_low':
            errorMessage = `${message.author}, too low! The count was **${(result?.expectedCount ?? 0) - 1}** and the next number should have been **${result.expectedCount}**. The count has been reset.`;
            break;
          case 'same_user':
            errorMessage = `${message.author}, you can't count twice in a row! The count has been reset. The next number should be **1**.`;
            break;
          default:
            errorMessage = `${message.author}, something went wrong with the count. The count has been reset. The next number should be **1**.`;
        }

        await resetCounting();

        await countingChannel.send(errorMessage);

        await message.react('❌');
      }
    } catch (error) {
      console.error('Error handling message create: ', error);
    }
  },
};

export default [messageCreate, messageDelete, messageUpdate];
