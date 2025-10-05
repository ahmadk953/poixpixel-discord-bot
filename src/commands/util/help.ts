import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  type ChatInputCommandInteraction,
} from 'discord.js';

import type { OptionsCommand } from '@/types/CommandTypes.js';
import type { ExtendedClient } from '@/structures/ExtendedClient.js';
import { safeRemoveComponents, safelyRespond } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const DOC_BASE_URL = 'https://docs.poixpixel.ahmadk953.org/';
const getDocUrl = (location: string) =>
  `${DOC_BASE_URL}?utm_source=discord&utm_medium=bot&utm_campaign=help_command&utm_content=${location}`;

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows a list of all available commands')
    .addStringOption((option) =>
      option
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false),
    ),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    try {
      const client = interaction.client as ExtendedClient;
      const commandName = interaction.options.getString('command');

      if (commandName) {
        await interaction.deferReply({ flags: ['Ephemeral'] });
        await handleSpecificCommand(interaction, client, commandName);
        return;
      } else {
        await interaction.deferReply();
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

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Poixpixel Bot Commands')
        .setDescription(
          '**Welcome to Poixpixel Discord Bot!**\n\n' +
            'Select a category from the dropdown menu below to see available commands.\n\n' +
            `📚 **Documentation:** [Visit Our Documentation](${getDocUrl('main_description')})`,
        )
        .setThumbnail(client.user?.displayAvatarURL() ?? null)
        .setFooter({
          text: 'Use /help [command] for detailed info about a command',
        });

      const categoryEmojis: Record<string, string> = {
        fun: '🎮',
        moderation: '🛡️',
        util: '🔧',
        testing: '🧪',
      };

      Array.from(categories.keys()).forEach((category) => {
  const emoji = categoryEmojis[category] ?? '📁';
        embed.addFields({
          name: `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
          value: `Use the dropdown to see ${category} commands`,
          inline: true,
        });
      });

      embed.addFields({
        name: '📚 Documentation',
        value: `[Click here to access our full documentation](${getDocUrl('main_footer_field')})`,
        inline: false,
      });

      const selectMenu =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Select a command category')
            .addOptions(
              Array.from(categories.keys()).map((category) => {
                const emoji = categoryEmojis[category] ?? '📁';
                return new StringSelectMenuOptionBuilder()
                  .setLabel(
                    category.charAt(0).toUpperCase() + category.slice(1),
                  )
                  .setDescription(`View ${category} commands`)
                  .setValue(category)
                  .setEmoji(emoji);
              }),
            ),
        );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [selectMenu],
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: 'You cannot use this menu.',
            flags: ['Ephemeral'],
          });
          return;
        }

        const selectedCategory = i.values[0];
        const commands = categories.get(selectedCategory);
  const emoji = categoryEmojis[selectedCategory] ?? '📁';

        const categoryEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(
            `${emoji} ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Commands`,
          )
          .setDescription('Here are all the commands in this category:')
          .setFooter({
            text: 'Use /help [command] for detailed info about a command',
          });

        commands.forEach(
          (cmd: { name: string; description?: string }) => {
            categoryEmbed.addFields({
              name: `/${cmd.name}`,
              value: cmd.description ?? 'No description available',
              inline: false,
            });
          },
        );

        categoryEmbed.addFields({
          name: '📚 Documentation',
          value: `[Click here to access our full documentation](${getDocUrl(`category_${selectedCategory}`)})`,
          inline: false,
        });

        await i.update({ embeds: [categoryEmbed], components: [selectMenu] });
      });

      collector.on('end', async () => {
        await safeRemoveComponents(message).catch(() => null);
      });
    } catch (error) {
      logger.error('[HelpCommand] Error executing help command', error);
      await safelyRespond(
        interaction,
        'An error occurred while processing your request.',
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
  commandName: string,
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
      text: `Poixpixel Discord Bot • Documentation: ${getDocUrl(`cmd_footer_${commandName}`)}`,
    });

  const { options } = cmd.data.toJSON();
  if (options && options.length > 0) {
    if (options[0].type === 1) {
      embed.addFields({
        name: 'Subcommands',
        value: options
          .map(
            (opt: { name: string; description: string }) =>
              `\`${opt.name}\`: ${opt.description}`,
          )
          .join('\n'),
        inline: false,
      });
    } else {
      embed.addFields({
        name: 'Options',
        value: options
          .map(
            (opt: {
              name: string;
              description: string;
              required?: boolean;
            }) =>
              `\`${opt.name}\`: ${opt.description} ${opt.required ? '(Required)' : '(Optional)'}`,
          )
          .join('\n'),
        inline: false,
      });
    }
  }

  embed.addFields({
    name: '📚 Documentation',
    value: `[Click here to access our full documentation](${getDocUrl(`cmd_field_${commandName}`)})`,
    inline: false,
  });

  return interaction.editReply({ embeds: [embed] });
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

    'test-join': 'testing',
    'test-leave': 'testing',
  };

  return commandCategories[commandName.toLowerCase()] || 'other';
}

export default command;
