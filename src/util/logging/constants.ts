import { ChannelType } from 'discord.js';

import type { LogActionType } from './types.js';

/**
 * Colors for different actions
 */
export const ACTION_COLORS: Record<LogActionType | 'default', number> = {
  // Danger actions - Red
  ban: 0xff_00_00,
  countingBan: 0xff_00_00,
  kick: 0xff_00_00,
  messageDelete: 0xff_00_00,
  channelDelete: 0xff_00_00,
  memberLeave: 0xff_00_00,
  roleDelete: 0xff_00_00,
  roleRemove: 0xff_00_00,
  purge: 0xff_00_00,

  // Warning actions - Orange
  warn: 0xff_aa_00,
  countingWarning: 0xff_aa_00,
  mute: 0xff_aa_00,
  roleUpdate: 0xff_aa_00,
  memberUsernameUpdate: 0xff_aa_00,
  memberNicknameUpdate: 0xff_aa_00,
  channelUpdate: 0xff_aa_00,
  messageEdit: 0xff_aa_00,

  // Success actions - Green
  unban: 0x00_ff_00,
  countingUnban: 0x00_ff_00,
  unmute: 0x00_ff_00,
  clearCountingWarnings: 0x00_ff_00,
  memberJoin: 0x00_aa_00,
  channelCreate: 0x00_aa_00,
  roleAdd: 0x00_aa_00,
  roleCreate: 0x00_aa_00,

  // Default - Blue
  default: 0x00_99_ff,
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
