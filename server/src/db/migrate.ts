import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';
import { db, client } from './client.js';

async function columnNames(table: string): Promise<Set<string>> {
  const info = await client.execute(`PRAGMA table_info("${table}")`);
  return new Set(info.rows.map((row) => String((row as { name?: unknown }).name ?? row[1])));
}

async function addColumnIfMissing(table: string, column: string, spec: string) {
  const cols = await columnNames(table);
  if (cols.has(column)) return;
  await client.execute(`ALTER TABLE "${table}" ADD COLUMN ${column} ${spec}`);
}

/**
 * Drizzle's libsql migrator only runs a file if its journal `when` is newer than the last
 * applied row. 0005 originally had an older timestamp, so production skipped it and every
 * order query failed. Add the columns directly if they are still missing.
 */
export async function runMigrations() {
  const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
  try {
    await migrate(db, { migrationsFolder });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
  await addColumnIfMissing('order', 'payment_proof_url', 'text');
  await addColumnIfMissing('order', 'payment_proof_public_id', 'text');
}

// Run directly: npm run db:migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runMigrations();
  // eslint-disable-next-line no-console
  console.info('Migrations applied.');
  client.close();
}
