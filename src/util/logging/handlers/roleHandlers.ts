import type { APIEmbedField } from 'discord.js';

import type {
  RoleCreateDeleteAction,
  RoleLogAction,
  RoleUpdateAction,
} from '../types.js';
import {
  createModeratorField,
  createPermissionChangeFields,
  createRoleChangeFields,
  createUserField,
} from '../utils.js';

/**
 * Build embed fields for role add/remove actions.
 */
export const handleRoleAddRemoveAction = (
  payload: RoleLogAction,
  fields: APIEmbedField[]
): void => {
  fields.push(createUserField(payload.member, 'User'), {
    name: 'Role',
    value: payload.role.name,
    inline: true,
  });

  const moderatorField = createModeratorField(
    payload.moderator,
    'Added/Removed By'
  );
  if (moderatorField) {
    fields.push(moderatorField);
  }
};

/**
 * Build embed fields for role create/delete actions.
 */
export const handleRoleCreateDeleteAction = (
  payload: RoleCreateDeleteAction,
  fields: APIEmbedField[]
): void => {
  fields.push(
    { name: 'Role Name', value: payload.role.name, inline: true },
    {
      name: 'Role Color',
      value: payload.role.hexColor ?? 'No Color',
      inline: true,
    },
    {
      name: 'Hoisted',
      value: payload.role.hoist ? 'Yes' : 'No',
      inline: true,
    },
    {
      name: 'Mentionable',
      value: payload.role.mentionable ? 'Yes' : 'No',
      inline: true,
    }
  );

  const moderatorField = createModeratorField(
    payload.moderator,
    payload.action === 'roleCreate' ? 'Created By' : 'Deleted By'
  );
  if (moderatorField) {
    fields.push(moderatorField);
  }
};

/**
 * Build embed fields for role update actions.
 */
export const handleRoleUpdateAction = (
  payload: RoleUpdateAction,
  fields: APIEmbedField[]
): void => {
  fields.push({
    name: '📝 Role Information',
    value: [
      `**Name:** ${payload.role.name}`,
      `**Color:** ${payload.role.hexColor}`,
      `**Position:** ${payload.role.position}`,
    ].join('\n'),
    inline: false,
  });

  const changes = createRoleChangeFields(payload.oldRole, payload.newRole);
  if (changes.length) {
    fields.push({
      name: '🔄 Changes Made',
      value: changes
        .map((field) => `**${field.name}:** ${field.value}`)
        .join('\n'),
      inline: false,
    });
  }

  fields.push(
    ...createPermissionChangeFields(
      payload.oldPermissions,
      payload.newPermissions
    )
  );

  const moderatorField = createModeratorField(
    payload.moderator,
    '👤 Modified By'
  );
  if (moderatorField) {
    fields.push(moderatorField);
  }
};
