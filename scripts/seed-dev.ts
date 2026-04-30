import { createClient } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/db/sqlite/schema';

const DEV_EMAIL = 'test@gmail.com';
const DEV_PASSWORD = 'Password1';
const DEV_NAME = 'Test User';

async function main() {
	if (process.env.DEV_SEED !== 'true') {
		console.log('DEV_SEED is not set to "true", skipping seed.');
		process.exit(0);
	}

	if (!process.env.DATABASE_URL) {
		console.error('DATABASE_URL is not set.');
		process.exit(1);
	}

	const provider = process.env.DATABASE_PROVIDER ?? 'libsql';
	if (provider !== 'libsql') {
		console.error(`Seed script only supports libsql, got DATABASE_PROVIDER="${provider}".`);
		process.exit(1);
	}

	const client = createClient({
		url: process.env.DATABASE_URL,
		...(process.env.ENCRYPTION_KEY ? { encryptionKey: process.env.ENCRYPTION_KEY } : {})
	});
	const db = drizzle(client, { schema });

	const existing = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.email, DEV_EMAIL))
		.limit(1);

	if (existing.length > 0) {
		console.log(`Seed user "${DEV_EMAIL}" already exists, skipping.`);
		process.exit(0);
	}

	const userId = crypto.randomUUID();
	const accountId = crypto.randomUUID();
	const now = new Date();
	const passwordHash = await hashPassword(DEV_PASSWORD);

	await db.insert(schema.user).values({
		id: userId,
		name: DEV_NAME,
		email: DEV_EMAIL,
		emailVerified: false,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.account).values({
		id: accountId,
		accountId: DEV_EMAIL,
		providerId: 'credential',
		userId,
		password: passwordHash,
		createdAt: now,
		updatedAt: now
	});

	console.log(`Seeded dev user: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
	process.exit(0);
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
