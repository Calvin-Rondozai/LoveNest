import { randomBytes } from 'node:crypto';
import { readdirSync, rmSync } from 'node:fs';
import { afterAll, beforeAll } from 'vitest';

// Remove databases left by earlier runs (Windows can keep the file locked until the process exits).
try {
  for (const f of readdirSync('./data')) if (f.startsWith('test-')) rmSync(`./data/${f}`, { force: true });
} catch {
  // Folder missing or a file still locked by another run: harmless.
}

// Configure a fresh, isolated database before any app module reads the environment.
const dbFile = `./data/test-${randomBytes(4).toString('hex')}.db`;
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: `file:${dbFile}`,
  BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
  BETTER_AUTH_URL: 'http://localhost:3000',
  ADMIN_ORIGINS: 'http://localhost:8080',
  SEED_ADMIN_EMAIL: 'admin@lovenest.test',
  SEED_ADMIN_PASSWORD: 'AdminPass123',
});

beforeAll(async () => {
  const { runMigrations } = await import('../src/db/migrate.js');
  await runMigrations();
});

afterAll(async () => {
  const { client } = await import('../src/db/client.js');
  client.close();
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try {
      rmSync(`${dbFile}${suffix}`, { force: true });
    } catch {
      // Still locked on Windows; the next run removes it.
    }
  }
});
