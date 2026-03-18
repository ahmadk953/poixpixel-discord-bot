import {
  ActionRowBuilder,
  type APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import type { MessageLogAction } from '../types.js';
import { createChannelField, createUserField } from '../utils.js';

/**
 * Build embed fields for deleted messages.
 */
export const handleMessageDeleteAction = (
  payload: MessageLogAction,
  fields: APIEmbedField[]
): void => {
  fields.push(
    createUserField(payload.message.author, 'Author'),
    createChannelField(payload.message.channel),
    {
      name: 'Content',
      value: payload.message.content ?? '*No content*',
      inline: false,
    }
  );
};

/**
 * Build embed fields and components for edited messages.
 */
export const handleMessageEditAction = (
  payload: MessageLogAction,
  fields: APIEmbedField[],
  components: ActionRowBuilder<ButtonBuilder>[]
): void => {
  fields.push(
    createUserField(payload.message.author, 'Author'),
    createChannelField(payload.message.channel),
    {
      name: 'Before',
      value: payload.oldContent ?? '*No content*',
      inline: false,
    },
    {
      name: 'After',
      value: payload.newContent ?? '*No content*',
      inline: false,
    }
  );

  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Jump to Message')
        .setStyle(ButtonStyle.Link)
        .setURL(payload.message.url)
    )
  );
};
