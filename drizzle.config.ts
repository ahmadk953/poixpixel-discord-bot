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
    ssl: {
      ca: fs.readFileSync(path.resolve('./certs/psql-ca.crt')),
      cert: fs.readFileSync(path.resolve('./certs/psql-server.crt')),
      key: fs.readFileSync(path.resolve('./certs/psql-client.key')),
    },
  },
});
