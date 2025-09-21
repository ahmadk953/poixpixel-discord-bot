import { AuditLogEvent, Events, Message, PartialMessage } from 'discord.js';

import { Event } from '@/types/EventTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import logAction from '@/util/logging/logAction.js';
import {
  checkAndAssignLevelRoles,
  processMessage,
} from '@/util/levelingSystem.js';
import { processLevelUpAchievements } from '@/util/achievementManager.js';
import {
  addCountingReactions,
  getCountingData,
  processCountingMessage,
  resetCounting,
} from '@/util/counting/countingManager.js';

const config = loadConfig();

const countingQueue: Message[] = [];
let isProcessingCounting = false;

async function processCountingQueue() {
  if (isProcessingCounting || countingQueue.length === 0) return;
  isProcessingCounting = true;
  const msg = countingQueue.shift()!;
  try {
    await handleCounting(msg);
  } catch (err) {
    console.error('Error processing queued counting message:', err);
  } finally {
    isProcessingCounting = false;
    processCountingQueue();
  }
}

async function handleCounting(message: Message) {
  const countingChannelId = config.channels.counting;
  const countingChannel = message.guild?.channels.cache.get(countingChannelId);
  if (!countingChannel?.isTextBased()) {
    console.error('Counting channel missing or not text-based');
    return;
  }

  const result = await processCountingMessage(message);
  if (result.isValid) {
    await addCountingReactions(message, result.milestoneType || 'normal');
    return;
  }

  if (result.reason === 'ignored' || result.reason === 'banned') {
    return;
  }

  let errorMessage: string;
  switch (result.reason) {
    case 'not_a_number':
      errorMessage = `${message.author}, that's not a valid number!`;
      break;
    case 'too_high':
      errorMessage = `${message.author}, too high! Was **${(result.expectedCount ?? 1) - 1}**, should be **${result.expectedCount}**.`;
      break;
    case 'too_low':
      errorMessage = `${message.author}, too low! Was **${(result.expectedCount ?? 1) - 1}**, should be **${result.expectedCount}**.`;
      break;
    case 'same_user':
      errorMessage = `${message.author}, no double count!`;
      break;
    default:
      errorMessage = `${message.author}, error resetting count.`;
  }

  if (typeof result.rolledBackTo === 'number') {
    const rolledTo = result.rolledBackTo;
    errorMessage += ` The count has been reset to **${rolledTo}**.`;
  } else if (result.reason === 'not_a_number') {
    await resetCounting();
    errorMessage += ' The count has been reset to **0**.';
  } else {
    console.error(
      `Counting handler encountered non-reset error (reason: ${result.reason}). Count left unchanged.`,
    );
  }

  await countingChannel.send(errorMessage);
  await message.react('❌');
}

async function handleLevelingMessage(message: Message) {
  try {
    const levelResult = await processMessage(message);
    const advId = config.channels.advancements;
    const advCh = message.guild?.channels.cache.get(advId);
    if (levelResult?.leveledUp && advCh?.isTextBased()) {
      await advCh.send(
        `🎉 Congrats <@${message.author.id}>! Level ${levelResult.newLevel}!`,
      );
      const assigned = await checkAndAssignLevelRoles(
        message.guild!,
        message.author.id,
        levelResult.newLevel,
      );
      await processLevelUpAchievements(
        message.author.id,
        levelResult.newLevel,
        message.guild!,
      );
      if (assigned) {
        await advCh.send(
          `<@${message.author.id}> You've earned <@&${assigned}>!`,
        );
      }
    }
  } catch (err) {
    console.error('Error in level handler:', err);
  }
}

export const messageDelete: Event<typeof Events.MessageDelete> = {
  name: Events.MessageDelete,
  execute: async (
    message: Omit<Partial<Message<boolean> | PartialMessage>, 'channel'>,
  ) => {
    try {
      if (!message.guild || message.author?.bot) return;

      try {
        const countingChannelId = config.channels.counting;
        if (
          message.channelId === countingChannelId &&
          message.content &&
          message.author
        ) {
          const trimmed = message.content.trim();
          const parsed = Number(trimmed);
          if (Number.isInteger(parsed)) {
            const data = await getCountingData();

            let allowRestore = true;
            try {
              const logs = await message.guild!.fetchAuditLogs({
                type: AuditLogEvent.MessageDelete,
                limit: 5,
              });
              const entries = Array.from(logs.entries.values());

              const matching = entries.find((e) => {
                const targetId = (e.target as any)?.id ?? (e as any).targetId;
                const channelId =
                  (e.extra as any)?.channel?.id ?? (e.extra as any)?.channelId;
                if (!targetId) return false;
                if (targetId !== message.author!.id) return false;
                if (channelId && channelId !== message.channelId) return false;
                return true;
              });

              const executor = matching?.executor;
              if (
                executor &&
                executor.id !== message.author!.id &&
                executor.id !== message.client?.user?.id
              ) {
                allowRestore = false;
              }
            } catch (auditErr) {
              console.warn(
                'Could not fetch audit logs when checking message deleter; allowing restore by fallback:',
                auditErr,
              );
              allowRestore = true;
            }

            if (data.currentCount === parsed && allowRestore) {
              const countingChannel =
                message.guild!.channels.cache.get(countingChannelId);
              if (countingChannel?.isTextBased()) {
                await countingChannel.send(
                  `🔁 Restoring deleted counting message: **${trimmed}** (originally by <@${message.author.id}>)`,
                );
              }
            }
          }
        }
      } catch (err) {
        console.error(
          'Error attempting to restore deleted counting message:',
          err,
        );
      }

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

      void handleLevelingMessage(message);

      const countingChannelId = config.channels.counting;
      if (message.channel.id === countingChannelId) {
        countingQueue.push(message);
        processCountingQueue();
      }
    } catch (error) {
      console.error('Error handling message create:', error);
    }
  },
};

export default [messageCreate, messageDelete, messageUpdate];
