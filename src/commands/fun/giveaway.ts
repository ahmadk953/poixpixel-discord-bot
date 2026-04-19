import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

import {
  endGiveaway,
  getActiveGiveaways,
  getGiveaway,
  rerollGiveaway,
} from '@/db/db.js';
import type { SubcommandCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import {
  builder,
  createGiveawayEmbed,
  formatWinnerMentions,
} from '@/util/giveaways/giveawayManager.js';
import {
  createPaginationButtons,
  safelyRespond,
  safeRemoveComponents,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Start creating a new giveaway')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all active giveaways')
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('Id of the giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Reroll winners for a giveaway')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('Id of the giveaway')
            .setRequired(true)
        )
    ),

  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    const config = loadConfig();
    const communityManagerRoleId = config.roles.staffRoles.find(
      (role) => role.name === 'Community Manager'
    )?.roleId;

    if (!communityManagerRoleId) {
      await safelyRespond(
        interaction,
        'Community Manager role not found in the configuration. Please contact a server admin.',
        true
      );
      return;
    }

    if (!interaction.guild) {
      await safelyRespond(interaction, 'Guild not found.', true);
      return;
    }

    if (
      !interaction.guild.members.cache
        .find((member) => member.id === interaction.user.id)
        ?.roles.cache.has(communityManagerRoleId)
    ) {
      await safelyRespond(
        interaction,
        'You do not have permission to manage giveaways.',
        true
      );
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
      default:
        await safelyRespond(
          interaction,
          `Unknown subcommand: \`${subcommand}\``,
          true
        );
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
  const GIVEAWAYS_PER_PAGE = 5;

  try {
    const activeGiveaways = await getActiveGiveaways();

    if (activeGiveaways.length === 0) {
      await safelyRespond(
        interaction,
        'There are no active giveaways at the moment.'
      );
      return;
    }

    const pages: EmbedBuilder[] = [];
    for (let i = 0; i < activeGiveaways.length; i += GIVEAWAYS_PER_PAGE) {
      const pageGiveaways = activeGiveaways.slice(i, i + GIVEAWAYS_PER_PAGE);

      const embed = new EmbedBuilder()
        .setTitle('🎉 Active Giveaways')
        .setColor(0x00_ff_00)
        .setDescription('Here are the currently active giveaways:')
        .setTimestamp();

      for (const giveaway of pageGiveaways) {
        embed.addFields({
          name: `${giveaway.prize} (ID: ${giveaway.id})`,
          value: [
            `**Hosted by:** <@${giveaway.hostId}>`,
            `**Winners:** ${giveaway.winnerCount}`,
            `**Ends:** <t:${Math.floor(giveaway.endAt.getTime() / 1000)}:R>`,
            `**Entries:** ${giveaway.participants?.length ?? 0}`,
            `[Jump to Giveaway](https://discord.com/channels/${interaction.guildId}/${giveaway.channelId}/${giveaway.messageId})`,
          ].join('\n'),
          inline: false,
        });
      }

      pages.push(embed);
    }

    let currentPage = 0;

    const message = await interaction.editReply({
      embeds: [pages[currentPage]],
      components: [createPaginationButtons(pages.length, currentPage)],
    });

    const collector = message.createMessageComponentCollector({
      time: 60_000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        if (await validateInteraction(i)) {
          await safelyRespond(i, 'You cannot use these buttons.', true);
        }
        return;
      }

      if (i.isButton()) {
        switch (i.customId) {
          case 'first_page':
            currentPage = 0;
            break;
          case 'prev_page':
            if (currentPage > 0) {
              currentPage--;
            }
            break;
          case 'next_page':
            if (currentPage < pages.length - 1) {
              currentPage++;
            }
            break;
          case 'last_page':
            currentPage = pages.length - 1;
            break;
          default:
            break;
        }

        await i.update({
          embeds: [pages[currentPage]],
          components: [createPaginationButtons(pages.length, currentPage)],
        });
      }
    });

    collector.on('end', async () => {
      await safeRemoveComponents(message).catch(() => null);
    });
  } catch (error) {
    logger.error('[GiveawayCommand] Error fetching active giveaways', error);
    await safelyRespond(
      interaction,
      'There was an error fetching the giveaways.'
    );
  }
}

/**
 * Handle the end giveaway subcommand
 */
async function handleEndGiveaway(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const id = interaction.options.getString('id', true);
  const giveaway = await getGiveaway(id, true);

  if (!giveaway) {
    await safelyRespond(interaction, `Giveaway with ID ${id} not found.`);
    return;
  }

  if (giveaway.status !== 'active') {
    await safelyRespond(interaction, 'This giveaway has already ended.');
    return;
  }

  const endedGiveaway = await endGiveaway(id, true);
  if (!endedGiveaway) {
    await safelyRespond(
      interaction,
      'Failed to end the giveaway. Please try again.'
    );
    return;
  }

  try {
    const channel = interaction.guild?.channels.cache.get(giveaway.channelId);
    if (!channel?.isTextBased()) {
      await safelyRespond(
        interaction,
        'Giveaway channel not found or is not a text channel.'
      );
      return;
    }

    const { messageId } = giveaway;
    const giveawayMessage = await channel.messages.fetch(messageId);

    if (!giveawayMessage) {
      await safelyRespond(interaction, 'Giveaway message not found.');
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
        `No one entered the giveaway for **${endedGiveaway.prize}**!`
      );
    }

    await interaction.editReply('Giveaway ended successfully!');
  } catch (error) {
    logger.error('[GiveawayCommand] Error ending giveaway', error);
    await safelyRespond(interaction, 'Failed to update the giveaway message.');
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
    await safelyRespond(interaction, `Giveaway with ID ${id} not found.`);
    return;
  }

  if (originalGiveaway.status !== 'ended') {
    await safelyRespond(
      interaction,
      'This giveaway is not yet ended. You can only reroll ended giveaways.'
    );
    return;
  }

  if (!originalGiveaway.participants?.length) {
    await safelyRespond(
      interaction,
      'Cannot reroll because no one entered this giveaway.'
    );
    return;
  }

  if (!originalGiveaway.participants?.length) {
    await safelyRespond(
      interaction,
      'Cannot reroll because no one entered this giveaway.'
    );
    return;
  }

  const rerolledGiveaway = await rerollGiveaway(id);

  if (!rerolledGiveaway) {
    await safelyRespond(
      interaction,
      'Failed to reroll the giveaway. An internal error occurred.'
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
    await safelyRespond(
      interaction,
      'Could not reroll: No other eligible participants found besides the previous winner(s).'
    );
    return;
  }
  if (newWinners.length === 0) {
    await safelyRespond(
      interaction,
      'Could not reroll: No eligible participants found.'
    );
    return;
  }

  try {
    const channel = interaction.guild?.channels.cache.get(
      rerolledGiveaway.channelId
    );
    if (!channel?.isTextBased()) {
      await safelyRespond(
        interaction,
        'Giveaway channel not found or is not a text channel. Reroll successful but announcement failed.'
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
    logger.error('[GiveawayCommand] Error announcing rerolled giveaway', error);
    await safelyRespond(
      interaction,
      'Giveaway rerolled, but failed to announce the new winners.'
    );
  }
}

export default command;
