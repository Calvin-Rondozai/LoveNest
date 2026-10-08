import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';
import { db, client } from './client.js';

/** Applies any pending migrations from ./drizzle. Safe to run on every deploy. */
export async function runMigrations() {
  const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });
}

// Run directly: npm run db:migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runMigrations();
  // eslint-disable-next-line no-console
  console.info('Migrations applied.');
  client.close();
}
