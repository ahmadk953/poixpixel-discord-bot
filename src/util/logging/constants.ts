import { ChannelType } from 'discord.js';
import { LogActionType } from './types';

/**
 * Colors for different actions
 */
export const ACTION_COLORS: Record<string, number> = {
  // Danger actions - Red
  ban: 0xff0000,
  kick: 0xff0000,
  messageDelete: 0xff0000,
  channelDelete: 0xff0000,
  memberLeave: 0xff0000,
  roleDelete: 0xff0000,

  // Warning actions - Orange
  warn: 0xffaa00,
  mute: 0xffaa00,
  roleUpdate: 0xffaa00,
  memberUsernameUpdate: 0xffaa00,
  memberNicknameUpdate: 0xffaa00,
  channelUpdate: 0xffaa00,
  messageUpdate: 0xffaa00,

  // Success actions - Green
  unban: 0x00ff00,
  unmute: 0x00ff00,
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
  kick: '👢',
  mute: '🔇',
  unban: '🔓',
  unmute: '🔊',
  warn: '⚠️',
  messageDelete: '📝',
  messageEdit: '✏️',
  memberJoin: '👋',
  memberLeave: '👋',
  memberUsernameUpdate: '📝',
  memberNicknameUpdate: '📝',
  roleAdd: '➕',
  roleRemove: '➖',
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
