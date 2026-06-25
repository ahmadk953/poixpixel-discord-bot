import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { type Attachment, AttachmentBuilder } from 'discord.js';

import { logger } from '@/util/logger.js';
import { ACTION_COLORS } from '../constants.js';
import type { PurgeLogAction } from '../types.js';
import { cleanupOldPurgeLogs } from '../utils.js';

export interface SendableLogChannel {
  send: (payload: {
    content?: string;
    embeds?: unknown[];
    files?: AttachmentBuilder[];
  }) => Promise<unknown>;
}

/**
 * Handle purge action by generating and attaching a purge transcript file.
 * Returns true when the action is fully handled and already sent.
 */
export const handlePurgeAction = async (
  payload: PurgeLogAction,
  logChannel: SendableLogChannel
): Promise<boolean> => {
  const messageLog: string[] = [];

  for (const message of payload.deletedMessages) {
    const timestamp = new Date(message.createdTimestamp).toISOString();
    const author = `${message.author.tag} (${message.author.id})`;
    const content = message.content ?? '[No text content]';
    const attachments = message.attachments.size
      ? `\n  Attachments: ${Array.from(message.attachments.values())
          .map((attachment: Attachment) => attachment.url ?? '')
          .filter(Boolean)
          .join(', ')}`
      : '';
    const embeds = message.embeds.length
      ? `\n  Embeds: ${message.embeds.length} embed(s)`
      : '';

    messageLog.push(
      `[${timestamp}] ${author}\n  Message ID: ${message.id}\n  Content: ${content}${attachments}${embeds}`
    );
  }

  const logHeader =
    'Purge Log\n' +
    `Channel: #${payload.channel.name} (${payload.channel.id})\n` +
    `Moderator: ${payload.moderator.user.tag} (${payload.moderator.id})\n` +
    `Reason: ${payload.reason}\n` +
    `Timestamp: ${new Date().toISOString()}\n` +
    `Age Limit: ${payload.ageLimit}\n` +
    `Messages Deleted: ${payload.deletedMessages.length}\n` +
    `${payload.skippedCount > 0 ? `Messages Skipped (too old): ${payload.skippedCount}\n` : ''}` +
    `\n${'='.repeat(80)}\n\n`;

  try {
    const tempDir = path.join(
      os.tmpdir(),
      'poixpixel-discord-bot',
      'purge-logs'
    );
    const logFileName = `purge-${payload.channel.id}-${Date.now()}.txt`;
    const logFilePath = path.join(tempDir, logFileName);

    await fs.mkdir(tempDir, { recursive: true });

    cleanupOldPurgeLogs(tempDir).catch((error: unknown) => {
      logger.debug(
        '[AuditLogManager] Background cleanup encountered error',
        error
      );
    });

    await fs.writeFile(
      logFilePath,
      logHeader + messageLog.join('\n\n'),
      'utf-8'
    );

    const attachment = new AttachmentBuilder(logFilePath, {
      name: logFileName,
      description: `Purge log for #${payload.channel.name}`,
    });

    try {
      await logChannel.send({
        content: `**Purge Action** | <#${payload.channel.id}>`,
        embeds: [
          {
            color: ACTION_COLORS.purge,
            title: '🗑️ PURGE',
            fields: [
              {
                name: 'Channel',
                value: `<#${payload.channel.id}>`,
                inline: true,
              },
              {
                name: 'Moderator',
                value: `${payload.moderator} (${payload.moderator.user.tag})`,
                inline: true,
              },
              {
                name: 'Messages Deleted',
                value: String(payload.deletedMessages.length),
                inline: true,
              },
              ...(payload.targetUser
                ? [
                    {
                      name: 'Target User',
                      value: `${payload.targetUser.tag} (${payload.targetUser.id})`,
                      inline: true,
                    },
                  ]
                : []),
              ...(payload.skippedCount > 0
                ? [
                    {
                      name: 'Messages Skipped',
                      value: `${payload.skippedCount} (older than ${payload.ageLimit})`,
                      inline: true,
                    },
                  ]
                : []),
              { name: 'Reason', value: payload.reason, inline: false },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `Moderator ID: ${payload.moderator.id}` },
          },
        ],
        files: [attachment],
      });

      return true;
    } catch (sendError: unknown) {
      logger.error('[AuditLogManager] Failed to send purge log', sendError);
    } finally {
      try {
        await fs.unlink(logFilePath);
      } catch (cleanupError: unknown) {
        logger.error(
          '[AuditLogManager] Failed to delete purge log file',
          cleanupError
        );
      }
    }
  } catch (writeError: unknown) {
    logger.error(
      '[AuditLogManager] Failed to create purge log file',
      writeError
    );
  }

  return false;
};
