import {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

import { SubcommandCommand } from '@/types/CommandTypes.js';
import {
  getGiveaway,
  getActiveGiveaways,
  endGiveaway,
  rerollGiveaway,
} from '@/db/db.js';
import {
  createGiveawayEmbed,
  formatWinnerMentions,
  builder,
} from '@/util/giveaways/giveawayManager.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Start creating a new giveaway'),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all active giveaways'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('Id of the giveaway')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Reroll winners for a giveaway')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('Id of the giveaway')
            .setRequired(true),
        ),
    ),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.ModerateMembers,
      )
    ) {
      await interaction.reply({
        content: 'You do not have permission to manage giveaways.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreateGiveaway(interaction);
        break;
      case 'list':
        await handleListGiveaways(interaction);
        break;
      case 'end':
        await handleEndGiveaway(interaction);
        break;
      case 'reroll':
        await handleRerollGiveaway(interaction);
        break;
    }
  },
};

/**
 * Initialize the giveaway creation process
 */
async function handleCreateGiveaway(interaction: ChatInputCommandInteraction) {
  await builder.startGiveawayBuilder(interaction);
}

/**
 * Handle the list giveaways subcommand
 */
async function handleListGiveaways(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const activeGiveaways = await getActiveGiveaways();

  if (activeGiveaways.length === 0) {
    await interaction.editReply('There are no active giveaways at the moment.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎉 Active Giveaways')
    .setColor(0x00ff00)
    .setTimestamp();

  const giveawayDetails = activeGiveaways.map((g) => {
    const channel = interaction.guild?.channels.cache.get(g.channelId);
    const channelMention = channel ? `<#${channel.id}>` : 'Unknown channel';

    return [
      `**Prize**: ${g.prize}`,
      `**ID**: ${g.id}`,
      `**Winners**: ${g.winnerCount}`,
      `**Ends**: <t:${Math.floor(g.endAt.getTime() / 1000)}:R>`,
      `**Channel**: ${channelMention}`,
      `**Entries**: ${g.participants?.length || 0}`,
      '───────────────────',
    ].join('\n');
  });

  embed.setDescription(giveawayDetails.join('\n'));

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle the end giveaway subcommand
 */
async function handleEndGiveaway(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const id = interaction.options.getString('id', true);
  const giveaway = await getGiveaway(id, true);

  if (!giveaway) {
    await interaction.editReply(`Giveaway with ID ${id} not found.`);
    return;
  }

  if (giveaway.status !== 'active') {
    await interaction.editReply('This giveaway has already ended.');
    return;
  }

  const endedGiveaway = await endGiveaway(id, true);
  if (!endedGiveaway) {
    await interaction.editReply(
      'Failed to end the giveaway. Please try again.',
    );
    return;
  }

  try {
    const channel = interaction.guild?.channels.cache.get(giveaway.channelId);
    if (!channel?.isTextBased()) {
      await interaction.editReply(
        'Giveaway channel not found or is not a text channel.',
      );
      return;
    }

    const messageId = giveaway.messageId;
    const giveawayMessage = await channel.messages.fetch(messageId);

    if (!giveawayMessage) {
      await interaction.editReply('Giveaway message not found.');
      return;
    }

    await giveawayMessage.edit({
      embeds: [
        createGiveawayEmbed({
          id: endedGiveaway.id,
          prize: endedGiveaway.prize,
          hostId: endedGiveaway.hostId,
          winnersIds: endedGiveaway.winnersIds ?? [],
          isEnded: true,
          footerText: 'Ended early by a moderator',
        }),
      ],
      components: [],
    });

    if (endedGiveaway.winnersIds?.length) {
      const winnerMentions = formatWinnerMentions(endedGiveaway.winnersIds);
      await channel.send({
        content: `Congratulations ${winnerMentions}! You won **${endedGiveaway.prize}**!`,
        allowedMentions: { users: endedGiveaway.winnersIds },
      });
    } else {
      await channel.send(
        `No one entered the giveaway for **${endedGiveaway.prize}**!`,
      );
    }

    await interaction.editReply('Giveaway ended successfully!');
  } catch (error) {
    console.error('Error ending giveaway:', error);
    await interaction.editReply('Failed to update the giveaway message.');
  }
}

/**
 * Handle the reroll giveaway subcommand
 */
async function handleRerollGiveaway(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ['Ephemeral'] });
  const id = interaction.options.getString('id', true);

  const originalGiveaway = await getGiveaway(id, true);

  if (!originalGiveaway) {
    await interaction.editReply(`Giveaway with ID ${id} not found.`);
    return;
  }

  if (originalGiveaway.status !== 'ended') {
    await interaction.editReply(
      'This giveaway is not yet ended. You can only reroll ended giveaways.',
    );
    return;
  }

  if (!originalGiveaway.participants?.length) {
    await interaction.editReply(
      'Cannot reroll because no one entered this giveaway.',
    );
    return;
  }

  const rerolledGiveaway = await rerollGiveaway(id);

  if (!rerolledGiveaway) {
    await interaction.editReply(
      'Failed to reroll the giveaway. An internal error occurred.',
    );
    return;
  }

  const previousWinners = originalGiveaway.winnersIds ?? [];
  const newWinners = rerolledGiveaway.winnersIds ?? [];

  const winnersChanged = !(
    previousWinners.length === newWinners.length &&
    previousWinners.every((w) => newWinners.includes(w))
  );

  if (!winnersChanged && newWinners.length > 0) {
    await interaction.editReply(
      'Could not reroll: No other eligible participants found besides the previous winner(s).',
    );
    return;
  }
  if (newWinners.length === 0) {
    await interaction.editReply(
      'Could not reroll: No eligible participants found.',
    );
    return;
  }

  try {
    const channel = interaction.guild?.channels.cache.get(
      rerolledGiveaway.channelId,
    );
    if (!channel?.isTextBased()) {
      await interaction.editReply(
        'Giveaway channel not found or is not a text channel. Reroll successful but announcement failed.',
      );
      return;
    }

    const winnerMentions = formatWinnerMentions(newWinners);
    await channel.send({
      content: `🎉 The giveaway for **${rerolledGiveaway.prize}** has been rerolled! New winner(s): ${winnerMentions}`,
      allowedMentions: { users: newWinners },
    });

    await interaction.editReply('Giveaway rerolled successfully!');
  } catch (error) {
    console.error('Error announcing rerolled giveaway:', error);
    await interaction.editReply(
      'Giveaway rerolled, but failed to announce the new winners.',
    );
  }
}

export default command;
