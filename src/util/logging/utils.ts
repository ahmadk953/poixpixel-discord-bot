import {
  User,
  GuildMember,
  GuildChannel,
  EmbedField,
  PermissionsBitField,
} from 'discord.js';
import { LogActionPayload, LogActionType, RoleProperties } from './types.js';
import { ACTION_EMOJIS } from './constants.js';

export const formatPermissionName = (perm: string): string => {
  return perm
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const createUserField = (
  user: User | GuildMember,
  label = 'User',
): EmbedField => ({
  name: label,
  value: `<@${user.id}>`,
  inline: true,
});

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

export const createChannelField = (channel: GuildChannel): EmbedField => ({
  name: 'Channel',
  value: `<#${channel.id}>`,
  inline: true,
});

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
      value: `${oldRole.color || 'None'} → ${newRole.color || 'None'}`,
      inline: true,
    });
  }

  const booleanProps: Array<
    keyof Pick<RoleProperties, 'hoist' | 'mentionable'>
  > = ['hoist', 'mentionable'];

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

export const getEmojiForAction = (action: LogActionType): string => {
  return ACTION_EMOJIS[action] || '📝';
};
