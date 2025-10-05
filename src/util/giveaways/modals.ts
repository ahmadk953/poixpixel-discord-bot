import {
  ActionRowBuilder,
  type ButtonInteraction,
  ModalBuilder,
  type StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

/**
 * Shows a modal to set the prize for a giveaway.
 * @param interaction The interaction that triggered the modal.
 */
export async function showPrizeModal(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_prize_modal')
    .setTitle('Set Giveaway Prize');

  const prizeInput = new TextInputBuilder()
    .setCustomId('prize_input')
    .setLabel('What are you giving away?')
    .setPlaceholder('e.g. Discord Nitro, Steam Game, etc.')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput),
  );
  await interaction.showModal(modal);
}

/**
 * Shows a modal to set custom duration.
 * @param interaction The interaction that triggered the modal.
 */
export async function showCustomDurationModal(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_custom_duration')
    .setTitle('Set Custom Duration');

  const durationInput = new TextInputBuilder()
    .setCustomId('duration_input')
    .setLabel('Duration (e.g. 4h30m, 2d12h)')
    .setPlaceholder('Enter custom duration')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
  );
  await interaction.showModal(modal);
}

/**
 * Shows a modal to set entry requirements.
 * @param interaction The interaction that triggered the modal.
 */
export async function showRequirementsModal(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_requirements_modal')
    .setTitle('Set Entry Requirements');

  const levelInput = new TextInputBuilder()
    .setCustomId('level_input')
    .setLabel('Min level (leave empty for none)')
    .setPlaceholder('e.g. 10')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const messageInput = new TextInputBuilder()
    .setCustomId('message_input')
    .setLabel('Min messages (leave empty for none)')
    .setPlaceholder('e.g. 100')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const roleInput = new TextInputBuilder()
    .setCustomId('role_input')
    .setLabel('Role ID (leave empty for none)')
    .setPlaceholder('e.g. 123456789012345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(levelInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
  );

  await interaction.showModal(modal);
}

/**
 * Shows a modal to set bonus entries for the giveaway.
 * @param interaction The interaction that triggered the modal.
 */
export async function showBonusEntriesModal(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_bonus_entries_modal')
    .setTitle('Bonus Entries Configuration');

  const rolesInput = new TextInputBuilder()
    .setCustomId('roles_input')
    .setLabel('Role bonuses')
    .setPlaceholder('format: roleId:entries,roleId:entries')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const levelsInput = new TextInputBuilder()
    .setCustomId('levels_input')
    .setLabel('Level bonuses')
    .setPlaceholder('format: level:entries,level:entries')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const messagesInput = new TextInputBuilder()
    .setCustomId('messages_input')
    .setLabel('Message bonuses')
    .setPlaceholder('format: count:entries,count:entries')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(rolesInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(levelsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messagesInput),
  );

  await interaction.showModal(modal);
}

/**
 * Shows a modal to select a role to ping.
 * @param interaction The interaction that triggered the modal.
 */
export async function showPingRoleSelectModal(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_ping_role_id_modal')
    .setTitle('Enter Role ID');

  const roleInput = new TextInputBuilder()
    .setCustomId('role_input')
    .setLabel('Role ID')
    .setPlaceholder('Enter the role ID to ping')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
  );
  await interaction.showModal(modal);
}

/**
 * Shows a modal to select the channel to host the giveaway.
 * @param interaction The interaction that triggered the modal.
 */
export async function showChannelSelectModal(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_channel_id_modal')
    .setTitle('Select Channel for Giveaway');

  const channelInput = new TextInputBuilder()
    .setCustomId('channel_input')
    .setLabel('Channel ID')
    .setPlaceholder('Enter the channel ID to host the giveaway')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput),
  );
  await interaction.showModal(modal);
}
