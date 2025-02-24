import { Config } from '../types/ConfigTypes.js';
import fs from 'node:fs';
import path from 'node:path';

export function loadConfig(): Config {
  try {
    const configPath = path.join(process.cwd(), './config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config: Config = JSON.parse(configFile);

    const requiredFields = ['token', 'clientId', 'guildId'];
    for (const field of requiredFields) {
      if (!config[field as keyof Config]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    process.exit(1);
  }
}
