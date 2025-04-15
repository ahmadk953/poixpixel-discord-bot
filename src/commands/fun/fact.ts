import {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import {
  addFact,
  getPendingFacts,
  approveFact,
  deleteFact,
  getLastInsertedFactId,
} from '@/db/db.js';
import { postFactOfTheDay } from '@/util/factManager.js';
import { loadConfig } from '@/util/configLoader.js';
import { SubcommandCommand } from '@/types/CommandTypes.js';

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
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('Source of the fact (optional)')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('approve')
        .setDescription('Approve a pending fact (Mod only)')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('The ID of the fact to approve')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a fact (Mod only)')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('The ID of the fact to delete')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pending')
        .setDescription('List all pending facts (Mod only)'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('post')
        .setDescription('Post a fact of the day manually (Admin only)'),
    ),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({
      flags: ['Ephemeral'],
    });
    await interaction.editReply('Processing...');

    const config = loadConfig();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'submit') {
      const content = interaction.options.getString('content', true);
      const source = interaction.options.getString('source') || undefined;

      const isAdmin = interaction.memberPermissions?.has(
        PermissionsBitField.Flags.Administrator,
      );

      await addFact({
        content,
        source,
        addedBy: interaction.user.id,
        approved: isAdmin ? true : false,
      });

      if (!isAdmin) {
        const approvalChannel = interaction.guild?.channels.cache.get(
          config.channels.factApproval,
        );

        if (approvalChannel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('New Fact Submission')
            .setDescription(content)
            .setColor(0x0099ff)
            .addFields(
              {
                name: 'Submitted By',
                value: `<@${interaction.user.id}>`,
                inline: true,
              },
              { name: 'Source', value: source || 'Not provided', inline: true },
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
            rejectButton,
          );

          await approvalChannel.send({
            embeds: [embed],
            components: [row],
          });
        } else {
          console.error('Approval channel not found or is not a text channel');
        }
      }

      await interaction.editReply({
        content: isAdmin
          ? 'Your fact has been automatically approved and added to the database!'
          : 'Your fact has been submitted for approval!',
      });
    } else if (subcommand === 'approve') {
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.ModerateMembers,
        )
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
    } else if (subcommand === 'delete') {
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.ModerateMembers,
        )
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
    } else if (subcommand === 'pending') {
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.ModerateMembers,
        )
      ) {
        await interaction.editReply({
          content: 'You do not have permission to view pending facts.',
        });
        return;
      }

      const pendingFacts = await getPendingFacts();

      if (pendingFacts.length === 0) {
        await interaction.editReply({
          content: 'There are no pending facts.',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Pending Facts')
        .setColor(0x0099ff)
        .setDescription(
          pendingFacts
            .map((fact) => {
              return `**ID #${fact.id}**\n${fact.content}\nSubmitted by: <@${fact.addedBy}>\nSource: ${fact.source || 'Not provided'}`;
            })
            .join('\n\n'),
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
      });
    } else if (subcommand === 'post') {
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.Administrator,
        )
      ) {
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
  },
};

export default command;
