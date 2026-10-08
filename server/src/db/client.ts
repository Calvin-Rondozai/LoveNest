import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../env.js';
import * as schema from './schema.js';

// Local development uses a SQLite file; make sure its folder exists.
if (env.DATABASE_URL.startsWith('file:')) {
  mkdirSync(dirname(env.DATABASE_URL.slice('file:'.length)), { recursive: true });
}

export const client = createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });

// Foreign keys are off by default in SQLite.
await client.execute('PRAGMA foreign_keys = ON');

export const db = drizzle(client, { schema });
export type Db = typeof db;
