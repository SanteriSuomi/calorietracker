import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = createClient({
	url: env.DATABASE_URL,
	...(env.ENCRYPTION_KEY ? { encryptionKey: env.ENCRYPTION_KEY } : {})
});

export const db = drizzle(client, { schema });
