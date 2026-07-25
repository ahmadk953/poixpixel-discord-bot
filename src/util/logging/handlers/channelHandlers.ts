import type { APIEmbedField } from 'discord.js';

import { CHANNEL_TYPES } from '../constants.js';
import type { ChannelLogAction, RoleLogAction } from '../types.js';
import {
  createModeratorField,
  getPermissionDifference,
  getPermissionNames,
} from '../utils.js';

type ChannelPermissionChange = NonNullable<
  ChannelLogAction['permissionChanges']
>[number];

const getTargetMention = (change: ChannelPermissionChange): string =>
  change.targetType === 'role'
    ? `<@&${change.targetId}>`
    : `<@${change.targetId}>`;

const addAddedPermissionFields = (
  changes: ChannelPermissionChange[],
  fields: APIEmbedField[]
): void => {
  if (!changes.length) {
    return;
  }

  fields.push({
    name: '➕ Added Permissions',
    value: changes
      .map(
        (change) =>
          `For ${change.targetType} ${getTargetMention(change)} (${change.targetName})`
      )
      .join('\n'),
    inline: false,
  });

  for (const change of changes) {
    if (!(change.allow?.bitfield || change.deny?.bitfield)) {
      continue;
    }

    const permissionLines: string[] = [];

    if (change.allow?.bitfield) {
      const allowedPerms = getPermissionNames(change.allow);
      if (allowedPerms.length) {
        permissionLines.push(`✅ **Allowed:** ${allowedPerms.join(', ')}`);
      }
    }

    if (change.deny?.bitfield) {
      const deniedPerms = getPermissionNames(change.deny);
      if (deniedPerms.length) {
        permissionLines.push(`❌ **Denied:** ${deniedPerms.join(', ')}`);
      }
    }

    if (permissionLines.length) {
      fields.push({
        name: `Permissions for ${change.targetType} ${change.targetName}`,
        value: permissionLines.join('\n'),
        inline: false,
      });
    }
  }
};

const addModifiedPermissionFields = (
  changes: ChannelPermissionChange[],
  fields: APIEmbedField[]
): void => {
  if (!changes.length) {
    return;
  }

  fields.push({
    name: '🔄 Modified Permissions',
    value: changes
      .map(
        (change) =>
          `For ${change.targetType} ${getTargetMention(change)} (${change.targetName})`
      )
      .join('\n'),
    inline: false,
  });

  for (const change of changes) {
    if (
      !(change.oldAllow && change.newAllow && change.oldDeny && change.newDeny)
    ) {
      continue;
    }

    const addedPerms = getPermissionDifference(
      change.newAllow,
      change.oldAllow
    );
    const removedPerms = getPermissionDifference(
      change.oldAllow,
      change.newAllow
    );
    const addedDenies = getPermissionDifference(change.newDeny, change.oldDeny);
    const removedDenies = getPermissionDifference(
      change.oldDeny,
      change.newDeny
    );

    const permissionLines: string[] = [];

    if (addedPerms.length) {
      permissionLines.push(`✅ **Newly Allowed:** ${addedPerms.join(', ')}`);
    }
    if (removedPerms.length) {
      permissionLines.push(
        `⬇️ **No Longer Allowed:** ${removedPerms.join(', ')}`
      );
    }
    if (addedDenies.length) {
      permissionLines.push(`❌ **Newly Denied:** ${addedDenies.join(', ')}`);
    }
    if (removedDenies.length) {
      permissionLines.push(
        `⬆️ **No Longer Denied:** ${removedDenies.join(', ')}`
      );
    }

    if (permissionLines.length) {
      fields.push({
        name: `Changes for ${change.targetType} ${change.targetName}`,
        value: permissionLines.join('\n'),
        inline: false,
      });
    }
  }
};

const addRemovedPermissionFields = (
  changes: ChannelPermissionChange[],
  fields: APIEmbedField[]
): void => {
  if (!changes.length) {
    return;
  }

  fields.push({
    name: '➖ Removed Permissions',
    value: changes
      .map(
        (change) =>
          `For ${change.targetType} ${getTargetMention(change)} (${change.targetName})`
      )
      .join('\n'),
    inline: false,
  });
};

/**
 * Build embed fields for channel update actions.
 */
export const handleChannelUpdateAction = (
  payload: ChannelLogAction,
  fields: APIEmbedField[]
): void => {
  const hasNameChange = payload.oldName !== payload.newName;
  const hasPermissionChanges = Boolean(payload.permissionChanges?.length);
  const hasSlowmodeChange = payload.oldSlowmode !== payload.newSlowmode;
  const hasParentChange = payload.oldParentId !== payload.newParentId;

  if (
    !(
      hasNameChange ||
      hasPermissionChanges ||
      hasSlowmodeChange ||
      hasParentChange
    )
  ) {
    return;
  }

  fields.push({
    name: '📝 Channel Information',
    value: [
      `**Channel:** <#${payload.channel.id}>`,
      `**Type:** ${CHANNEL_TYPES[payload.channel.type]}`,
      hasNameChange
        ? `**Name Change:** ${payload.oldName} → ${payload.newName}`
        : null,
      hasSlowmodeChange
        ? `**Slowmode Change:** ${payload.oldSlowmode}s → ${payload.newSlowmode}s`
        : null,
      hasParentChange
        ? `**Category Change:** <#${payload.oldParentId}> → <#${payload.newParentId}>`
        : null,
    ]
      .filter(Boolean)
      .join('\n'),
    inline: false,
  });

  const changes = payload.permissionChanges ?? [];
  const added = changes.filter((change) => change.action === 'added');
  const modified = changes.filter((change) => change.action === 'modified');
  const removed = changes.filter((change) => change.action === 'removed');

  addAddedPermissionFields(added, fields);
  addModifiedPermissionFields(modified, fields);
  addRemovedPermissionFields(removed, fields);

  const moderatorField = createModeratorField(
    payload.moderator,
    '👤 Modified By'
  );
  if (moderatorField) {
    fields.push(moderatorField);
  }
};

/**
 * Build embed fields for channel create/delete actions.
 */
export const handleChannelCreateDeleteAction = (
  channel: {
    id: string;
    name: string;
    type: number;
  },
  moderator: RoleLogAction['moderator'],
  fields: APIEmbedField[]
): void => {
  fields.push(
    {
      name: 'Channel',
      value: `<#${channel.id}> (#${channel.name})`,
      inline: true,
    },
    {
      name: 'Type',
      value: CHANNEL_TYPES[channel.type] ?? String(channel.type),
      inline: true,
    }
  );

  const moderatorField = createModeratorField(moderator, 'Created/Deleted By');
  if (moderatorField) {
    fields.push(moderatorField);
  }
};
