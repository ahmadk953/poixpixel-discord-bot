import { AuditLogEvent, Events, type Message, type PartialMessage } from 'discord.js';

import type { Event } from '@/types/EventTypes.js';
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
import { logger } from '@/util/logger.js';

const config = loadConfig();

const countingQueue: Message[] = [];
let isProcessingCounting = false;

/**
 * Processes the counting message queue.
 */
async function processCountingQueue() {
  if (isProcessingCounting || countingQueue.length === 0) return;
  isProcessingCounting = true;
  const msg = countingQueue.shift();

  if (!msg) {
    isProcessingCounting = false;
    return;
  }

  try {
    await handleCounting(msg);
  } catch (error) {
    logger.error(
      '[MessageEvents] Error processing queued counting message',
      error,
    );
  } finally {
    isProcessingCounting = false;
    processCountingQueue();
  }
}

/**
 * Handles counting messages.
 * @param message The message to handle.
 */
async function handleCounting(message: Message) {
  const countingChannelId = config.channels.counting;
  const countingChannel = message.guild?.channels.cache.get(countingChannelId);
  if (!countingChannel?.isTextBased()) {
    logger.error('[MessageEvents] Counting channel missing or not text-based');
    return;
  }

  const result = await processCountingMessage(message);
  if (result.isValid) {
    await addCountingReactions(message, result.milestoneType ?? 'normal');
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
    logger.error(
      `[MessageEvents] Counting handler encountered non-reset error (reason: ${result.reason}). Count left unchanged.`,
    );
  }

  await countingChannel.send(errorMessage);
  await message.react('❌');
}

async function handleLevelingMessage(message: Message) {
  try {
    if (!message.guild) return;

    const { guild } = message;
    const levelResult = await processMessage(message);
    const advId = config.channels.advancements;
    const advCh = guild.channels.cache.get(advId);
    if (levelResult?.leveledUp && advCh?.isTextBased()) {
      await advCh.send(
        `🎉 Congrats <@${message.author.id}>! Level ${levelResult.newLevel}!`,
      );
      const assigned = await checkAndAssignLevelRoles(
        guild,
        message.author.id,
        levelResult.newLevel,
      );
      await processLevelUpAchievements(
        message.author.id,
        levelResult.newLevel,
        guild,
      );
      if (assigned) {
        await advCh.send(
          `<@${message.author.id}> You've earned <@&${assigned}>!`,
        );
      }
    }
  } catch (error) {
    logger.error('[MessageEvents] Error processing leveling message', error);
  }
}

export const messageDelete: Event<typeof Events.MessageDelete> = {
  name: Events.MessageDelete,
  execute: async (
    message: Omit<Partial<Message<boolean> | PartialMessage>, 'channel'>,
  ) => {
    try {
      if (!message.guild || message.author?.bot) return;

      const { guild } = message;

      try {
        const countingChannelId = config.channels.counting;
        if (
          message.channelId === countingChannelId &&
          message.content &&
          message.author
        ) {
          const { author } = message;
          const trimmed = message.content.trim();
          const parsed = Number(trimmed);
          if (Number.isInteger(parsed)) {
            const data = await getCountingData();

            let allowRestore = true;
            try {
              const logs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MessageDelete,
                limit: 5,
              });
              const entries = Array.from(logs.entries.values());

              const matching = entries.find((e) => {
                const target = e.target as { id?: string } | null;
                const targetId = target?.id ?? (e as { targetId?: string }).targetId;
                const extra = e.extra as { channel?: { id?: string }; channelId?: string } | null;
                const channelId = extra?.channel?.id ?? extra?.channelId;
                if (!targetId) return false;
                if (!author || targetId !== author.id) return false;
                if (channelId && channelId !== message.channelId) return false;
                return true;
              });

              const executor = matching?.executor;
              if (
                executor &&
                author &&
                executor.id !== author.id &&
                executor.id !== message.client?.user?.id
              ) {
                allowRestore = false;
              }
            } catch (error) {
              logger.warn(
                '[MessageEvents] Could not fetch audit logs when checking message delete; allowing restore by fallback',
                error,
              );
              allowRestore = true;
            }

            if (data.currentCount === parsed && allowRestore) {
              const countingChannel =
                guild.channels.cache.get(countingChannelId);
              if (countingChannel?.isTextBased()) {
                await countingChannel.send(
                  `🔁 Restoring deleted counting message: **${trimmed}** (originally by <@${message.author.id}>)`,
                );
              }
            }
          }
        }
      } catch (error) {
        logger.error(
          '[MessageEvents] Error attempting to restore deleted counting message',
          error,
        );
      }

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
      logger.error('[MessageEvents] Error handling message delete', error);
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
      logger.error('[MessageEvents] Error handling message update', error);
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
      logger.error('[MessageEvents] Error handling message create', error);
    }
  },
};

export default [messageCreate, messageDelete, messageUpdate];
