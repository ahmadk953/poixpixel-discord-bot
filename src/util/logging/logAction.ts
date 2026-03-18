import type {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
} from 'discord.js';

import { loadConfig } from '../configLoader.js';
import { logger } from '../logger.js';
import { ACTION_COLORS } from './constants.js';
import {
  handleChannelCreateDeleteAction,
  handleChannelUpdateAction,
} from './handlers/channelHandlers.js';
import {
  handleMemberJoinLeaveAction,
  handleMemberNameUpdateAction,
} from './handlers/memberHandlers.js';
import {
  handleMessageDeleteAction,
  handleMessageEditAction,
} from './handlers/messageHandlers.js';
import { handleModerationAction } from './handlers/moderationHandlers.js';
import {
  handlePurgeAction,
  type SendableLogChannel,
} from './handlers/purgeHandler.js';
import {
  handleRoleAddRemoveAction,
  handleRoleCreateDeleteAction,
  handleRoleUpdateAction,
} from './handlers/roleHandlers.js';
import type { LogActionPayload } from './types.js';
import { getEmojiForAction, getLogItemId } from './utils.js';

/**
 * Logs an action to the configured logs channel.
 */
export default async function logAction(
  payload: LogActionPayload
): Promise<void> {
  const config = loadConfig();
  const logChannel = payload.guild.channels.cache.get(config.channels.logs);

  if (!logChannel?.isTextBased()) {
    logger.warn(
      '[AuditLogManager] Log channel not found or is not a Text Channel.'
    );
    return;
  }

  const fields: APIEmbedField[] = [];
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  let alreadyHandled = false;

  switch (payload.action) {
    case 'ban':
    case 'kick':
    case 'mute':
    case 'unban':
    case 'unmute':
    case 'warn':
    case 'countingWarning':
    case 'countingBan':
    case 'countingUnban':
    case 'clearCountingWarnings': {
      handleModerationAction(payload, fields);
      break;
    }

    case 'messageDelete': {
      handleMessageDeleteAction(payload, fields);
      break;
    }

    case 'messageEdit': {
      handleMessageEditAction(payload, fields, components);
      break;
    }

    case 'purge': {
      alreadyHandled = await handlePurgeAction(
        payload,
        logChannel as SendableLogChannel
      );
      break;
    }

    case 'memberJoin':
    case 'memberLeave': {
      handleMemberJoinLeaveAction(payload.member, fields);
      break;
    }

    case 'memberUsernameUpdate':
    case 'memberNicknameUpdate': {
      handleMemberNameUpdateAction(payload, fields);
      break;
    }

    case 'roleAdd':
    case 'roleRemove': {
      handleRoleAddRemoveAction(payload, fields);
      break;
    }

    case 'roleCreate':
    case 'roleDelete': {
      handleRoleCreateDeleteAction(payload, fields);
      break;
    }

    case 'roleUpdate': {
      handleRoleUpdateAction(payload, fields);
      break;
    }

    case 'channelUpdate': {
      handleChannelUpdateAction(payload, fields);
      break;
    }

    case 'channelCreate':
    case 'channelDelete': {
      handleChannelCreateDeleteAction(
        payload.channel,
        payload.moderator,
        fields
      );
      break;
    }

    default: {
      logger.warn(
        `[AuditLogManager] Unknown log action: ${(payload as { action?: string }).action}`
      );
      break;
    }
  }

  if (alreadyHandled) {
    return;
  }

  const logEmbed = {
    color: ACTION_COLORS[payload.action] ?? ACTION_COLORS.default,
    title: `${getEmojiForAction(payload.action)} ${payload.action.toUpperCase()}`,
    fields: fields.filter(
      (field): field is APIEmbedField =>
        typeof field?.name === 'string' && typeof field?.value === 'string'
    ),
    timestamp: new Date().toISOString(),
    footer: {
      text: `ID: ${getLogItemId(payload)}`,
    },
  };

  await logChannel.send({
    embeds: [logEmbed],
    components: components.length ? components : undefined,
  });
}
