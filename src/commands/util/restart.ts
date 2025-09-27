import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';

import { Command } from '@/types/CommandTypes.js';
import {
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';
import { isRedisConnected } from '@/db/redis.js';
import { ensureDatabaseConnection } from '@/db/db.js';

const execAsync = promisify(exec);

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription('(Manager Only) Restart the bot'),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    await interaction.editReply({
      content: 'Restarting the bot... This may take a few moments.',
    });

    const dbConnected = await ensureDatabaseConnection();
    const redisConnected = isRedisConnected();
    let statusInfo = '';

    if (!dbConnected) {
      statusInfo += '⚠️ Database is currently disconnected\n';
    }

    if (!redisConnected) {
      statusInfo += '⚠️ Redis caching is currently unavailable\n';
    }

    if (dbConnected && redisConnected) {
      statusInfo = '✅ All services are operational\n';
    }

    await notifyManagers(
      interaction.client,
      NotificationType.BOT_RESTARTING,
      `Restart initiated by ${interaction.user.tag}\n\nCurrent service status:\n${statusInfo}`,
    );

    setTimeout(async () => {
      try {
        console.log(
          `Bot restart initiated by ${interaction.user.tag} (${interaction.user.id})`,
        );

        await execAsync('yarn restart');
      } catch (error) {
        console.error('Failed to restart the bot:', error);
        try {
          await interaction.followUp({
            content:
              'Failed to restart the bot. Check the console for details.',
            flags: ['Ephemeral'],
          });
        } catch {
          // If this fails too, we can't do much
        }
      }
    }, 1000);
  },
};

export default command;
