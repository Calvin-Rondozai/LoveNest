import { serve } from '@hono/node-server';
import { app } from './app.js';
import { client } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { env } from './env.js';

// Apply pending migrations before accepting traffic, so every deploy is self-updating.
await runMigrations();

// First deploy: create the categories, starter products and first admin. Idempotent, and only
// when SEED_ADMIN_EMAIL/PASSWORD are set; remove SEED_ADMIN_PASSWORD once you have signed in.
if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
  const result = await seed();
  // eslint-disable-next-line no-console
  console.info(`Seed checked (admin: ${result.admin}).`);
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.info(`LoveNest API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

const shutdown = () => {
  server.close(() => {
    client.close();
    process.exit(0);
  });
  // Force exit if connections do not close in time.
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
