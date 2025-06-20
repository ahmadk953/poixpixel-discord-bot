import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { database } = config;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: database.dbConnectionString,
    ssl: (() => {
      try {
        return {
          ca: fs.readFileSync(path.resolve('./certs/rootCA.pem')),
        };
      } catch (error) {
        console.warn(
          'Failed to load certificates for database, using insecure connection:',
          error,
        );
        return undefined;
      }
    })(),
  },
});
