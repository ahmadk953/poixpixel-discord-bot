import fs from 'node:fs';
import { Client, Collection, Events, GatewayIntentBits, GuildMember } from 'discord.js';

import { deployCommands } from './util/deployCommand.js';
import { removeMember, setMembers } from './util/db.js';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { token, guildId } = config;

const client: any = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
client.commands = new Collection();

try {
  const commands = await deployCommands();
  if (!commands) {
    throw new Error('No commands found.');
  }
  commands.forEach(async (command) => {
    try {
      client.commands.set(command.data.name, command);
    }
    catch (error: any) {
      console.error(`Error while creating command: ${error}`);
    }
  });
  console.log('Commands registered successfully.');
}
catch (error: any) {
  console.error(`Error while registering commands: ${error}`);
}

client.once(Events.ClientReady, async (c: Client) => {
  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch();
  const nonBotMembers = members.filter((member: any) => !member.user.bot);

  await setMembers(nonBotMembers);

  console.log(`Ready! Logged in as ${c!.user!.tag}`);
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

client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch();
  const nonBotMembers = members.filter((dbMember: any) => !dbMember.user.bot);

  // TODO: Move this to the config file
  const welcomeChannel = guild.channels.cache.get('1007949346031026186');

  try {
    await setMembers(nonBotMembers);
    // TODO: Move this to config file
    await welcomeChannel.send(`Welcome to the server, ${member.user.username}!`);
    await member.user.send('Welcome to the Poixpixel Discord server!');
  }
  catch (error: any) {
    console.error(`Error while adding member: ${error}`);
  }
});

client.on(Events.GuildMemberRemove, async (member: GuildMember) => {
  await removeMember(member.user.id);
});

client.login(token);
