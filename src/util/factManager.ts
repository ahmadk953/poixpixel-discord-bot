import { type Client, EmbedBuilder } from 'discord.js';

import {
  getAllApprovedFacts,
  getRandomUnusedFact,
  markFactAsUsed,
} from '@/db/db.js';
import { loadConfig } from './configLoader.js';
import { logger } from './logger.js';

let isFactScheduled = false;

/**
 * Schedule the fact of the day to be posted daily
 * @param client - The Discord client
 */
export function scheduleFactOfTheDay(client: Client): void {
  if (isFactScheduled) {
    logger.verbose(
      '[FactManager] Fact of the day already scheduled, skipping duplicate schedule'
    );
    return;
  }

  try {
    isFactScheduled = true;
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      postFactOfTheDay(client);
      isFactScheduled = false;
      scheduleFactOfTheDay(client);
    }, timeUntilMidnight);

    logger.info(
      `[FactManager] Next fact of the day scheduled in ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes`
    );
  } catch (error) {
    logger.error('[FactManager] Error scheduling fact of the day', error);
    isFactScheduled = false;
    setTimeout(() => scheduleFactOfTheDay(client), 60 * 60 * 1000);
  }
}

/**
 * Post the fact of the day to the configured channel
 * @param client - The Discord client
 */
export async function postFactOfTheDay(client: Client): Promise<void> {
  try {
    const config = loadConfig();
    const guild = client.guilds.cache.get(config.guildId);

    if (!guild) {
      logger.warn('[FactManager] Guild not found');
      return;
    }

    const factChannel = guild.channels.cache.get(config.channels.factOfTheDay);
    if (!factChannel?.isTextBased()) {
      logger.warn(
        '[FactManager] Fact channel not found or is not a text channel'
      );
      return;
    }

    // First try to get a random unused fact
    let fact = await getRandomUnusedFact();

    // If no unused facts, get all approved facts and pick one at random
    if (!fact) {
      logger.warn('[FactManager] No unused facts available, resetting usage');

      // Get all approved facts for fallback
      const allFacts = await getAllApprovedFacts();
      if (allFacts.length > 0) {
        fact = allFacts[Math.floor(Math.random() * allFacts.length)];
      } else {
        logger.warn('[FactManager] No facts available at all');
        return;
      }
    }

    if (!fact) {
      logger.warn('[FactManager] No facts available');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🌟 Fact of the Day 🌟')
      .setDescription(fact.content)
      .setColor(0xff_aa_00)
      .setTimestamp();

    if (fact.source) {
      embed.setFooter({ text: `Source: ${fact.source}` });
    }

    await factChannel.send({
      content: `<@&${config.roles.factPingRole}>`,
      embeds: [embed],
    });

    if (!fact.id) {
      logger.warn('[FactManager] Fact missing identifier, cannot mark as used');
      return;
    }

    try {
      await markFactAsUsed(fact.id);
    } catch (error) {
      logger.error('[FactManager] Failed to mark fact as used', error);
      // Continue with posting the fact even if marking as used fails
    }
  } catch (error) {
    logger.error('[FactManager] Error posting fact of the day', error);
  }
}
