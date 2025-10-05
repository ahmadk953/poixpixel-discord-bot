import {
  ActionRowBuilder,
  type ButtonInteraction,
  StringSelectMenuBuilder,
} from 'discord.js';

/**
 * Show a select menu for pinging a role.
 * @param interaction The button interaction that triggered this function.
 */
export async function showPingRoleSelect(
  interaction: ButtonInteraction,
): Promise<void> {
  const roles = interaction.guild?.roles.cache
    .filter((role) => role.id !== interaction.guild?.id)
    .sort((a, b) => a.position - b.position)
    .map((role) => ({
      label: role.name.substring(0, 25),
      value: role.id,
      description: `@${role.name}`,
    }));

  if (!roles?.length) {
    await interaction.reply({
      content: 'No roles found in this server.',
      flags: ['Ephemeral'],
    });
    return;
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('giveaway_ping_role_select')
      .setPlaceholder('Select a role to ping (optional)')
      .addOptions([...roles.slice(0, 25)]),
  );

  await interaction.reply({
    content: 'Select a role to ping when the giveaway starts:',
    components: [row],
    flags: ['Ephemeral'],
  });
}

/**
 * Show a select menu for choosing a duration for the giveaway.
 * @param interaction The button interaction that triggered this function.
 */
export async function showDurationSelect(
  interaction: ButtonInteraction,
): Promise<void> {
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('giveaway_duration_select')
      .setPlaceholder('Select duration')
      .addOptions([
        { label: '1 hour', value: '1h', description: 'End giveaway in 1 hour' },
        {
          label: '6 hours',
          value: '6h',
          description: 'End giveaway in 6 hours',
        },
        {
          label: '12 hours',
          value: '12h',
          description: 'End giveaway in 12 hours',
        },
        { label: '1 day', value: '1d', description: 'End giveaway in 1 day' },
        { label: '3 days', value: '3d', description: 'End giveaway in 3 days' },
        { label: '7 days', value: '7d', description: 'End giveaway in 7 days' },
        {
          label: 'Custom',
          value: 'custom',
          description: 'Set a custom duration',
        },
      ]),
  );

  await interaction.reply({
    content: 'Select the duration for your giveaway:',
    components: [row],
    flags: ['Ephemeral'],
  });
}

/**
 * Show a select menu for choosing the number of winners for the giveaway.
 * @param interaction The button interaction that triggered this function.
 */
export async function showWinnerSelect(
  interaction: ButtonInteraction,
): Promise<void> {
  const options = [1, 2, 3, 5, 10].map((num) => ({
    label: `${num} winner${num > 1 ? 's' : ''}`,
    value: num.toString(),
    description: `Select ${num} winner${num > 1 ? 's' : ''} for the giveaway`,
  }));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('giveaway_winners_select')
      .setPlaceholder('Select number of winners')
      .addOptions(options),
  );

  await interaction.reply({
    content: 'How many winners should this giveaway have?',
    components: [row],
    flags: ['Ephemeral'],
  });
}

/**
 * Show a select menu for choosing a channel for the giveaway.
 * @param interaction The button interaction that triggered this function.
 */
export async function showChannelSelect(
  interaction: ButtonInteraction,
): Promise<void> {
  const channels = interaction.guild?.channels.cache
    .filter((channel) => channel.isTextBased())
    .map((channel) => ({
      label: channel.name.substring(0, 25),
      value: channel.id,
      description: `#${channel.name}`,
    }))
    .slice(0, 25);

  if (!channels?.length) {
    await interaction.reply({
      content: 'No suitable text channels found in this server.',
      flags: ['Ephemeral'],
    });
    return;
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('giveaway_channel_select')
      .setPlaceholder('Select a channel')
      .addOptions(channels),
  );

  await interaction.reply({
    content: 'Select the channel to host the giveaway in:',
    components: [row],
    flags: ['Ephemeral'],
  });
}
