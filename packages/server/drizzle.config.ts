import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/traces/schema/traces.schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.GOAT_DB_PATH || './data/goat_telemetry.db',
  },
});
