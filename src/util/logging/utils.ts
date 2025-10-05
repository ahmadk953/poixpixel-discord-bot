import {
  type User,
  type GuildMember,
  type GuildChannel,
  type EmbedField,
  PermissionsBitField,
} from 'discord.js';

import type {
  LogActionPayload,
  LogActionType,
  RoleProperties,
} from './types.js';
import { ACTION_EMOJIS } from './constants.js';

/**
 * Formats a permission name to be more readable
 * @param perm - The permission to format
 * @returns - The formatted permission name
 */
export const formatPermissionName = (perm: string): string => {
  return perm
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Creates a field for a user
 * @param user - The user to create a field for
 * @param label - The label for the field
 * @returns - The created field
 */
export const createUserField = (
  user: User | GuildMember,
  label = 'User',
): EmbedField => ({
  name: label,
  value: `<@${user.id}>`,
  inline: true,
});

/**
 * Creates a field for a moderator
 * @param moderator - The moderator to create a field for
 * @param label - The label for the field
 * @returns - The created field
 */
export const createModeratorField = (
  moderator?: GuildMember,
  label = 'Moderator',
): EmbedField | null =>
  moderator
    ? {
        name: label,
        value: `<@${moderator.id}>`,
        inline: true,
      }
    : null;

/**
 * Creates a field for a channel
 * @param channel - The channel to create a field for
 * @returns - The created field
 */
export const createChannelField = (channel: GuildChannel): EmbedField => ({
  name: 'Channel',
  value: `<#${channel.id}>`,
  inline: true,
});

/**
 * Creates a field for changed permissions
 * @param oldPerms - The old permissions
 * @param newPerms - The new permissions
 * @returns - The created fields
 */
export const createPermissionChangeFields = (
  oldPerms: Readonly<PermissionsBitField>,
  newPerms: Readonly<PermissionsBitField>,
): EmbedField[] => {
  const fields: EmbedField[] = [];
  const changes: { added: string[]; removed: string[] } = {
    added: [],
    removed: [],
  };

  Object.keys(PermissionsBitField.Flags).forEach((perm) => {
    const hasOld = oldPerms.has(perm as keyof typeof PermissionsBitField.Flags);
    const hasNew = newPerms.has(perm as keyof typeof PermissionsBitField.Flags);

    if (hasOld !== hasNew) {
      if (hasNew) {
        changes.added.push(formatPermissionName(perm));
      } else {
        changes.removed.push(formatPermissionName(perm));
      }
    }
  });

  if (changes.added.length) {
    fields.push({
      name: '✅ Added Permissions',
      value: changes.added.join('\n'),
      inline: true,
    });
  }

  if (changes.removed.length) {
    fields.push({
      name: '❌ Removed Permissions',
      value: changes.removed.join('\n'),
      inline: true,
    });
  }

  return fields;
};

/**
 * Gets the names of the permissions in a bitfield
 * @param permissions - The permissions to get the names of
 * @returns - The names of the permissions
 */
export const getPermissionNames = (
  permissions: Readonly<PermissionsBitField>,
): string[] => {
  const names: string[] = [];

  Object.keys(PermissionsBitField.Flags).forEach((perm) => {
    if (permissions.has(perm as keyof typeof PermissionsBitField.Flags)) {
      names.push(formatPermissionName(perm));
    }
  });

  return names;
};

/**
 * Compares two bitfields and returns the names of the permissions that are in the first bitfield but not the second
 * @param a - The first bitfield
 * @param b - The second bitfield
 * @returns - The names of the permissions that are in the first bitfield but not the second
 */
export const getPermissionDifference = (
  a: Readonly<PermissionsBitField>,
  b: Readonly<PermissionsBitField>,
): string[] => {
  const names: string[] = [];

  Object.keys(PermissionsBitField.Flags).forEach((perm) => {
    const permKey = perm as keyof typeof PermissionsBitField.Flags;
    if (a.has(permKey) && !b.has(permKey)) {
      names.push(formatPermissionName(perm));
    }
  });

  return names;
};

/**
 * Creates a field for a role
 * @param oldRole - The old role
 * @param newRole - The new role
 * @returns - The fields for the role changes
 */
export const createRoleChangeFields = (
  oldRole: Partial<RoleProperties>,
  newRole: Partial<RoleProperties>,
): EmbedField[] => {
  const fields: EmbedField[] = [];

  if (oldRole.name !== newRole.name) {
    fields.push({
      name: 'Name Changed',
      value: `${oldRole.name} → ${newRole.name}`,
      inline: true,
    });
  }

  if (oldRole.color !== newRole.color) {
    fields.push({
      name: 'Color Changed',
      value: `${oldRole.color ?? 'None'} → ${newRole.color ?? 'None'}`,
      inline: true,
    });
  }

  const booleanProps: (keyof Pick<RoleProperties, 'hoist' | 'mentionable'>)[] =
    ['hoist', 'mentionable'];

  for (const prop of booleanProps) {
    if (oldRole[prop] !== newRole[prop]) {
      fields.push({
        name: `${prop.charAt(0).toUpperCase() + prop.slice(1)} Changed`,
        value: `${oldRole[prop] ? 'Yes' : 'No'} → ${newRole[prop] ? 'Yes' : 'No'}`,
        inline: true,
      });
    }
  }

  return fields;
};

/**
 * Gets the ID of the item that was logged
 * @param payload - The payload to get the log item ID from
 * @returns - The ID of the log item
 */
export const getLogItemId = (payload: LogActionPayload): string => {
  switch (payload.action) {
    case 'roleCreate':
    case 'roleDelete':
    case 'roleUpdate':
    case 'roleAdd':
    case 'roleRemove':
      return payload.role.id;

    case 'channelCreate':
    case 'channelDelete':
    case 'channelUpdate':
      return payload.channel.id;

    case 'messageDelete':
    case 'messageEdit':
      return payload.message.id;

    case 'memberJoin':
    case 'memberLeave':
      return payload.member.id;

    case 'ban':
    case 'kick':
    case 'mute':
    case 'unban':
    case 'unmute':
    case 'warn':
      return payload.target.id;

    default:
      return 'N/A';
  }
};

/**
 * Gets the emoji for an action
 * @param action - The action to get an emoji for
 * @returns - The emoji for the action
 */
export const getEmojiForAction = (action: LogActionType): string => {
  return ACTION_EMOJIS[action] ?? '📝';
};
