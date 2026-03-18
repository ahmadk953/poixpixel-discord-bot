import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type MessageComponentInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import {
  addFact,
  approveFact,
  deleteFact,
  getLastInsertedFactId,
  getPendingFacts,
} from '@/db/db.js';
import type { SubcommandCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import { postFactOfTheDay } from '@/util/factManager.js';
import {
  createPaginationButtons,
  safeRemoveComponents,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('fact')
    .setDescription('Manage facts of the day')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submit')
        .setDescription('Submit a new fact for approval')
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('The fact content')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('Source of the fact (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('approve')
        .setDescription('Approve a pending fact (Mod only)')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('The ID of the fact to approve')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a fact (Mod only)')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('The ID of the fact to delete')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pending')
        .setDescription('List all pending facts (Mod only)')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('post')
        .setDescription('Post a fact of the day manually (Admin only)')
    ),

  execute: async (interaction) => {
    if (!(interaction.isChatInputCommand() && interaction.guild)) {
      return;
    }

    await interaction.deferReply({
      flags: ['Ephemeral'],
    });

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'submit':
        await handleSubmitFact(interaction);
        break;
      case 'approve':
        await handleApproveFact(interaction);
        break;
      case 'delete':
        await handleDeleteFact(interaction);
        break;
      case 'pending':
        await handlePendingFacts(interaction);
        break;
      case 'post':
        await handlePostFact(interaction);
        break;
      default:
        await interaction.editReply({
          content: 'Unknown subcommand.',
        });
    }
  },
};

/**
 * Handles pagination interaction collection for pending facts.
 */
async function handlePaginationCollect(
  i: MessageComponentInteraction,
  interaction: ChatInputCommandInteraction,
  pages: EmbedBuilder[],
  createPaginationButtons: (
    totalPages: number,
    currentPage: number
  ) => ActionRowBuilder<ButtonBuilder>,
  currentPage: number,
  setCurrentPage: (newPage: number) => void
): Promise<void> {
  if (i.user.id !== interaction.user.id) {
    await i.reply({
      content: 'These controls are not for you!',
      flags: ['Ephemeral'],
    });
    return;
  }

  let newPage = currentPage;

  if (i.isButton() && 'customId' in i) {
    switch (i.customId) {
      case 'first_page':
        newPage = 0;
        break;
      case 'prev_page':
        if (currentPage > 0) {
          newPage = currentPage - 1;
        }
        break;
      case 'next_page':
        if (currentPage < pages.length - 1) {
          newPage = currentPage + 1;
        }
        break;
      case 'last_page':
        newPage = pages.length - 1;
        break;
      default:
        break;
    }
  }

  if (i.isStringSelectMenu()) {
    const selected = Number.parseInt(i.values[0], 10);
    if (!Number.isNaN(selected) && selected >= 0 && selected < pages.length) {
      newPage = selected;
    }
  }

  setCurrentPage(newPage);

  await i.update({
    embeds: [pages[newPage]],
    components: [createPaginationButtons(pages.length, newPage).toJSON()],
  });
}

/**
 * Handles the 'submit' subcommand for submitting a new fact.
 */
async function handleSubmitFact(interaction: ChatInputCommandInteraction) {
  const config = loadConfig();
  const content = interaction.options.getString('content', true);
  const source = interaction.options.getString('source') ?? undefined;

  const isAdmin = interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );

  await addFact({
    content,
    source,
    addedBy: interaction.user.id,
    approved: !!isAdmin,
  });

  if (!isAdmin) {
    const approvalChannel = interaction.guild?.channels.cache.get(
      config.channels.factApproval
    );

    if (approvalChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('New Fact Submission')
        .setDescription(content)
        .setColor(0x00_99_ff)
        .addFields(
          {
            name: 'Submitted By',
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          { name: 'Source', value: source ?? 'Not provided', inline: true }
        )
        .setTimestamp();

      const factId = await getLastInsertedFactId();

      const approveButton = new ButtonBuilder()
        .setCustomId(`approve_fact_${factId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId(`reject_fact_${factId}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        approveButton,
        rejectButton
      );

      await approvalChannel.send({
        embeds: [embed],
        components: [row],
      });
    } else {
      logger.error(
        '[FactCommand] Fact approval channel not found or is not a text channel'
      );
    }
  }

  await interaction.editReply({
    content: isAdmin
      ? 'Your fact has been automatically approved and added to the database!'
      : 'Your fact has been submitted for approval!',
  });
}

/**
 * Handles the 'approve' subcommand for approving a pending fact.
 */
async function handleApproveFact(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await interaction.editReply({
      content: 'You do not have permission to approve facts.',
    });
    return;
  }

  const id = interaction.options.getInteger('id', true);
  await approveFact(id);

  await interaction.editReply({
    content: `Fact #${id} has been approved!`,
  });
}

/**
 * Handles the 'delete' subcommand for deleting a fact.
 */
async function handleDeleteFact(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await interaction.editReply({
      content: 'You do not have permission to delete facts.',
    });
    return;
  }

  const id = interaction.options.getInteger('id', true);
  await deleteFact(id);

  await interaction.editReply({
    content: `Fact #${id} has been deleted!`,
  });
}

/**
 * Handles the 'pending' subcommand for listing all pending facts.
 */
async function handlePendingFacts(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await interaction.editReply({
      content: 'You do not have permission to view pending facts.',
    });
    return;
  }

  const FACTS_PER_PAGE = 5;
  const pendingFacts = await getPendingFacts();

  if (pendingFacts.length === 0) {
    await interaction.editReply({
      content: 'There are no pending facts.',
    });
    return;
  }

  const pages: EmbedBuilder[] = [];
  for (let i = 0; i < pendingFacts.length; i += FACTS_PER_PAGE) {
    const pageFacts = pendingFacts.slice(i, i + FACTS_PER_PAGE);

    const embed = new EmbedBuilder()
      .setTitle('Pending Facts')
      .setColor(0x00_99_ff)
      .setDescription(
        pageFacts
          .map((fact) => {
            return `**ID #${fact.id}**\n${fact.content}\nSubmitted by: <@${fact.addedBy}>\nSource: ${fact.source ?? 'Not provided'}`;
          })
          .join('\n\n')
      )
      .setTimestamp();

    pages.push(embed);
  }

  let currentPage = 0;

  const message = await interaction.editReply({
    embeds: [pages[currentPage]],
    components: [createPaginationButtons(pages.length, currentPage).toJSON()],
  });

  if (pages.length <= 1) {
    return;
  }

  const collector = message.createMessageComponentCollector({
    time: 60_000,
  });

  collector.on('collect', async (i) => {
    await handlePaginationCollect(
      i,
      interaction,
      pages,
      createPaginationButtons,
      currentPage,
      (newPage) => {
        currentPage = newPage;
      }
    );
  });

  collector.on('end', async () => {
    await safeRemoveComponents(message).catch(() => null);
  });
}

/**
 * Handles the 'post' subcommand for manually posting a fact of the day.
 */
async function handlePostFact(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: 'You do not have permission to manually post facts.',
    });
    return;
  }

  await postFactOfTheDay(interaction.client);

  await interaction.editReply({
    content: 'Fact of the day has been posted!',
  });
}

export default command;
