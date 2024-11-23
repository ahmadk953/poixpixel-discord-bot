import fs from "node:fs";
import { defineConfig } from 'drizzle-kit';

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const { dbConnectionString } = config;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbConnectionString,
  },
});
