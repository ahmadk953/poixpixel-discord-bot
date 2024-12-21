import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
const commandsPath = path.join(__dirname, 'target', 'commands');

const getFilesRecursively = (directory: string): string[] => {
  const files: string[] = [];
  const filesInDirectory = fs.readdirSync(directory);

  for (const file of filesInDirectory) {
    const filePath = path.join(directory, file);

    if (fs.statSync(filePath).isDirectory()) {
      files.push(...getFilesRecursively(filePath));
    }
    else if (file.endsWith('.js')) {
      files.push(filePath);
    }
  }

  return files;
};

const commandFiles = getFilesRecursively(commandsPath);

export const deployCommands = async () => {
  try {
    console.log(
      `Started refreshing ${commandFiles.length} application (/) commands.`
    );

    const commands = commandFiles.map(async (file) => {
      const commandModule = await import(`file://${file}`);
      const command = commandModule.default;

      if (
        command instanceof Object &&
        'data' in command &&
        'execute' in command
      ) {
        return command;
      }
      else {
        console.warn(
          `[WARNING] The command at ${file} is missing a required "data" or "execute" property.`
        );
        return null;
      }
    });

    const validCommands = await Promise.all(
      commands.filter((command) => command !== null)
    );

    return validCommands;
  }
  catch (error) {
    console.error(error);
  }
};
