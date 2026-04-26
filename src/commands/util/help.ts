import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

import type { ExtendedClient } from '@/structures/ExtendedClient.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import {
  safelyRespond,
  safeRemoveComponents,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const DOC_URL = 'https://ahmadk953.gitbook.io/poixpixel-discord-bot';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows a list of all available commands')
    .addStringOption((option) =>
      option
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false)
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

    try {
      const client = interaction.client as ExtendedClient;
      const commandName = interaction.options.getString('command');

      await interaction.deferReply();
      if (commandName) {
        await handleSpecificCommand(interaction, client, commandName);
        return;
      }

      const categories = new Map();

      for (const [name, cmd] of client.commands) {
        const category = getCategoryFromCommand(name);

        if (!categories.has(category)) {
          categories.set(category, []);
        }

        categories.get(category).push({
          name,
          description: cmd.data.toJSON().description,
        });
      }

      const categoryEmojis: Record<string, string> = {
        fun: '🎮',
        moderation: '🛡️',
        util: '🔧',
        testing: '🧪',
      };

      const categoryOptions = Array.from(categories.keys()).map((category) => {
        const emoji = categoryEmojis[category] ?? '📁';
        return new StringSelectMenuOptionBuilder()
          .setLabel(category.charAt(0).toUpperCase() + category.slice(1))
          .setDescription(`View ${category} commands`)
          .setValue(category)
          .setEmoji(emoji);
      });

      const embedDescription =
        categoryOptions.length <= 25
          ? '**Welcome to Poixpixel Discord Bot!**\n\n' +
            'Select a category from the dropdown menu below to see available commands.\n\n' +
            `📚 **Documentation:** [Visit Our Documentation](${DOC_URL})`
          : '**Welcome to Poixpixel Discord Bot!**\n\n' +
            'There are too many categories to display a dropdown menu. Use `/help [command]` to get detailed help for a specific command, or visit the documentation linked below.\n\n' +
            `📚 **Documentation:** [Visit Our Documentation](${DOC_URL})`;

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Poixpixel Bot Commands')
        .setDescription(embedDescription)
        .setThumbnail(client.user?.displayAvatarURL() ?? null)
        .setFooter({
          text: 'Use /help [command] for detailed info about a command',
        });

      for (const category of categories.keys()) {
        const emoji = categoryEmojis[category] ?? '📁';
        const fieldValue =
          categoryOptions.length <= 25
            ? `Use the dropdown to see ${category} commands`
            : `Use /help [command] to view ${category} commands`;

        embed.addFields({
          name: `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
          value: fieldValue,
          inline: true,
        });
      }

      embed.addFields({
        name: '📚 Documentation',
        value: `[Click here to access our full documentation](${DOC_URL})`,
        inline: false,
      });

      const selectMenu =
        categoryOptions.length <= 25
          ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('help_category_select')
                .setPlaceholder('Select a command category')
                .addOptions(categoryOptions)
            )
          : null;

      const message = await interaction.editReply({
        embeds: [embed],
        components: selectMenu ? [selectMenu] : [],
      });

      if (selectMenu) {
        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000,
        });

        collector.on('collect', async (i) => {
          if (!(await validateInteraction(i))) {
            return;
          }

          if (i.user.id !== interaction.user.id) {
            await safelyRespond(i, 'You cannot use this menu.', true);
            return;
          }

          const selectedCategory = i.values[0];
          const commands = categories.get(selectedCategory) as {
            name: string;
            description?: string;
          }[];
          const emoji = categoryEmojis[selectedCategory] ?? '📁';

          const categoryEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(
              `${emoji} ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Commands`
            )
            .setDescription('Here are all the commands in this category:')
            .setFooter({
              text: 'Use /help [command] for detailed info about a command',
            });

          for (const cmd of commands) {
            categoryEmbed.addFields({
              name: `/${cmd.name}`,
              value: cmd.description ?? 'No description available',
              inline: false,
            });
          }

          categoryEmbed.addFields({
            name: '📚 Documentation',
            value: `[Click here to access our full documentation](${DOC_URL})`,
            inline: false,
          });

          await i.update({ embeds: [categoryEmbed], components: [selectMenu] });
        });

        collector.on('end', async () => {
          await safeRemoveComponents(message).catch(() => null);
        });
      }
    } catch (error) {
      logger.error('[HelpCommand] Error executing help command', error);
      await safelyRespond(
        interaction,
        'An error occurred while processing your request.'
      );
    }
  },
};

/**
 * Handle showing help for a specific command
 */
async function handleSpecificCommand(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  commandName: string
) {
  const cmd = client.commands.get(commandName);

  if (!cmd) {
    return interaction.editReply({
      content: `Command \`${commandName}\` not found.`,
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`Help: /${commandName}`)
    .setDescription(cmd.data.toJSON().description ?? 'No description available')
    .addFields({
      name: 'Category',
      value: getCategoryFromCommand(commandName),
      inline: true,
    })
    .setFooter({
      text: `Poixpixel Discord Bot • Documentation: ${DOC_URL}`,
    });

  const { options } = cmd.data.toJSON();
  if (options && options.length > 0) {
    if (options[0].type === 1) {
      embed.addFields({
        name: 'Subcommands',
        value: options
          .map(
            (opt: { name: string; description: string }) =>
              `\`${opt.name}\`: ${opt.description}`
          )
          .join('\n'),
        inline: false,
      });
    } else {
      embed.addFields({
        name: 'Options',
        value: options
          .map(
            (opt: { name: string; description: string; required?: boolean }) =>
              `\`${opt.name}\`: ${opt.description} ${opt.required ? '(Required)' : '(Optional)'}`
          )
          .join('\n'),
        inline: false,
      });
    }
  }

  embed.addFields({
    name: '📚 Documentation',
    value: `[Click here to access our full documentation](${DOC_URL})`,
    inline: false,
  });

  return await interaction.editReply({ embeds: [embed] });
}

/**
 * Get the category of a command based on its name
 */
function getCategoryFromCommand(commandName: string): string {
  const commandCategories: Record<string, string> = {
    achievement: 'fun',
    fact: 'fun',
    rank: 'fun',
    counting: 'fun',
    giveaway: 'fun',
    leaderboard: 'fun',
    achievements: 'fun',

    ban: 'moderation',
    kick: 'moderation',
    mute: 'moderation',
    unmute: 'moderation',
    warn: 'moderation',
    unban: 'moderation',

    ping: 'util',
    server: 'util',
    'user-info': 'util',
    members: 'util',
    rules: 'util',
    'manage-achievements': 'util',
    'backend-manager': 'util',
    'reload-config': 'util',
    restart: 'util',
    reconnect: 'util',
    xp: 'util',
    'recalculate-levels': 'util',
    help: 'util',
    config: 'util',
    purge: 'util',

    'test-join': 'testing',
    'test-leave': 'testing',
  };

  return commandCategories[commandName.toLowerCase()] || 'other';
}

export default command;
