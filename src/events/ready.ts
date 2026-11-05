import { ActivityType, type Client, Events } from 'discord.js';

import {
  ensureDbInitialized,
  setDiscordClient as setDbDiscordClient,
  setMembers,
} from '@/db/db.js';
import {
  ensureRedisConnection,
  setDiscordClient as setRedisDiscordClient,
} from '@/db/redis.js';
import type { Event } from '@/types/EventTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import { rehydrateCountingAutoUnbans } from '@/util/counting/countingManager.js';
import { scheduleFactOfTheDay } from '@/util/factManager.js';
import { scheduleGiveaways } from '@/util/giveaways/giveawayManager.js';
import { loadActiveBans, loadActiveMutes } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    const config = loadConfig();
    setRedisDiscordClient(client);
    setDbDiscordClient(client);

    await ensureDbInitialized();
    ensureRedisConnection();

    const guild = client.guilds.cache.find(
      (guilds) => guilds.id === config.guildId
    );

    if (!guild) {
      throw new Error(`[ReadyEvent] Guild with ID ${config.guildId} not found`);
    }

    const members = await guild.members.fetch();
    const nonBotMembers = members.filter((m) => !m.user.bot);
    await setMembers(nonBotMembers);

    await loadActiveBans(client, guild);
    await loadActiveMutes(client, guild);

    await rehydrateCountingAutoUnbans(client);

    scheduleFactOfTheDay(client);
    await scheduleGiveaways(client);

    client.user?.setActivity(`Watching ${guild.name}`, {
      type: ActivityType.Watching,
    });

    logger.info(`[ReadyEvent] Ready! Logged in as ${client.user?.tag}`);
  },
} as Event<typeof Events.ClientReady>;
