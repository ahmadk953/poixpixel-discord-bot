import type { APIEmbedField } from 'discord.js';

import type { ModerationLogAction } from '../types.js';
import { createModeratorField, createUserField } from '../utils.js';

/**
 * Build embed fields for moderation and counting actions.
 */
export const handleModerationAction = (
  payload: ModerationLogAction,
  fields: APIEmbedField[]
): void => {
  if (payload.action === 'clearCountingWarnings') {
    if (payload.target) {
      fields.push(createUserField(payload.target, 'Target'));
    }

    const moderatorField = createModeratorField(payload.moderator, 'Moderator');
    if (moderatorField) {
      fields.push(moderatorField);
    }

    if (payload.reason) {
      fields.push({
        name: 'Action',
        value: payload.reason,
        inline: false,
      });
    }

    return;
  }

  fields.push(createUserField(payload.target, 'User'));

  const moderatorField = createModeratorField(payload.moderator, 'Moderator');
  if (moderatorField) {
    fields.push(moderatorField);
  }

  fields.push({
    name: 'Reason',
    value: payload.reason ?? 'No reason provided',
    inline: false,
  });

  if (payload.duration) {
    fields.push({
      name: 'Duration',
      value: payload.duration,
      inline: true,
    });
  }
};
