import { ChannelType } from 'discord.js';
import type { LogActionType } from './types.js';

/**
 * Colors for different actions
 */
export const ACTION_COLORS: Record<LogActionType | 'default', number> = {
  // Danger actions - Red
  ban: 0xff0000,
  countingBan: 0xff0000,
  kick: 0xff0000,
  messageDelete: 0xff0000,
  channelDelete: 0xff0000,
  memberLeave: 0xff0000,
  roleDelete: 0xff0000,
  roleRemove: 0xff0000,
  purge: 0xff0000,

  // Warning actions - Orange
  warn: 0xffaa00,
  countingWarning: 0xffaa00,
  mute: 0xffaa00,
  roleUpdate: 0xffaa00,
  memberUsernameUpdate: 0xffaa00,
  memberNicknameUpdate: 0xffaa00,
  channelUpdate: 0xffaa00,
  messageEdit: 0xffaa00,

  // Success actions - Green
  unban: 0x00ff00,
  countingUnban: 0x00ff00,
  unmute: 0x00ff00,
  clearCountingWarnings: 0x00ff00,
  memberJoin: 0x00aa00,
  channelCreate: 0x00aa00,
  roleAdd: 0x00aa00,
  roleCreate: 0x00aa00,

  // Default - Blue
  default: 0x0099ff,
};

/**
 * Emojis for different actions
 */
export const ACTION_EMOJIS: Record<LogActionType, string> = {
  roleCreate: '⭐',
  roleDelete: '🗑️',
  roleUpdate: '📝',
  channelCreate: '📢',
  channelDelete: '🗑️',
  channelUpdate: '🔧',
  ban: '🔨',
  countingBan: '🔨',
  kick: '👢',
  mute: '🔇',
  unban: '🔓',
  countingUnban: '🔓',
  unmute: '🔊',
  warn: '⚠️',
  countingWarning: '⚠️',
  clearCountingWarnings: '✅',
  messageDelete: '📝',
  messageEdit: '✏️',
  memberJoin: '👋',
  memberLeave: '👋',
  memberUsernameUpdate: '📝',
  memberNicknameUpdate: '📝',
  roleAdd: '➕',
  roleRemove: '➖',
  purge: '🗑️',
};

/**
 * Types of channels
 */
export const CHANNEL_TYPES: Record<number, string> = {
  [ChannelType.GuildText]: 'Text Channel',
  [ChannelType.GuildVoice]: 'Voice Channel',
  [ChannelType.GuildCategory]: 'Category',
  [ChannelType.GuildStageVoice]: 'Stage Channel',
  [ChannelType.GuildForum]: 'Forum Channel',
  [ChannelType.GuildAnnouncement]: 'Announcement Channel',
  [ChannelType.GuildMedia]: 'Media Channel',
};
