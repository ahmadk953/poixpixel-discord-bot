import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from './structures/ExtendedClient.js';
import { loadConfig } from './util/configLoader.js';

async function startBot() {
  try {
    const config = loadConfig();

    const client = new ExtendedClient(
      {
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildModeration,
        ],
      },
      config,
    );

    await client.initialize();
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();
