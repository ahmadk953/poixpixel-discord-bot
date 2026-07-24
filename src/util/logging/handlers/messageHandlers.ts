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
 * @param payload The log action payload.
 * @param fields The array of embed fields to push to.
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

  if (payload.message.attachments.size > 0) {
    const attachments = payload.message.attachments
      .map((att) => `[${att.name}](${att.url})`)
      .join('\n');
    fields.push({
      name: 'Attachments',
      value: attachments,
      inline: false,
    });
  }
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
