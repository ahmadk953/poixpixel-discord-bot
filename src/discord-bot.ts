import fs from 'node:fs';
import path from 'node:path';
import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';

import { deployCommands } from './util/deployCommand.js';
import { getMember, removeMember, setMembers } from './util/db.js';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { token, guildId } = config;

const client: any = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
client.commands = new Collection();

try {
  const __dirname = path.resolve();

  const commandsPath = path.join(__dirname, '/target/commands/');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join('file://', commandsPath, file);
    const commandModule = await import(filePath);
    const command = commandModule.default;

    if (
      command instanceof Object &&
      'data' in command &&
      'execute' in command
    ) {
      client.commands.set(command.data.name, command);
    }
    else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}
catch (error: any) {
  console.log(`Error while getting commands up: ${error}`);
}

try {
  await deployCommands();
}
catch (error: any) {
  console.log(`Error while registering commands: ${error}`);
}

client.once(Events.ClientReady, async (c: any) => {
  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch();
  const nonBotMembers = members.filter((member: any) => !member.user.bot);

  await setMembers(nonBotMembers);

  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: any) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  }
  catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
    else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  }
});

client.on(Events.GuildMemberAdd, async () => {
  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch();
  const nonBotMembers = members.filter((member: any) => !member.user.bot);

  await setMembers(nonBotMembers);
});

client.on(Events.GuildMemberRemove, async (member: any) => {
  await removeMember(member.user.id);
});

client.login(token);
