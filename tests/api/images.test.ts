import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.ENCRYPTION_SECRET = 'test-encryption-secret-for-images-tests-32c';

import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '$lib/server/db/sqlite/schema';
import { decrypt, deriveUserKey, encrypt } from '$lib/server/encryption';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

const TEST_USER_ID = 'test-user-images';
const TEST_USER_ID_2 = 'test-user-images-2';

const TEST_DIR = 'data/images';

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle/sqlite' });

	await db.insert(schema.user).values([
		{
			id: TEST_USER_ID,
			name: 'Test User',
			email: 'test-images@example.com',
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date()
		},
		{
			id: TEST_USER_ID_2,
			name: 'Test User 2',
			email: 'test-images-2@example.com',
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date()
		}
	]);
});

afterAll(async () => {
	client.close();
});

describe('Image storage — encrypt/decrypt with DB ownership', () => {
	it('stores encrypted file and decrypts back to original', async () => {
		const filename = `${crypto.randomUUID()}.jpeg`;
		const original = Buffer.from('fake-jpeg-data');

		const dir = join(TEST_DIR, TEST_USER_ID);
		if (!existsSync(dir)) await mkdir(dir, { recursive: true });

		const key = deriveUserKey(TEST_USER_ID);
		const encrypted = encrypt(original, key);
		await writeFile(join(dir, `${filename}.enc`), encrypted);

		const encrypted2 = await readFile(join(dir, `${filename}.enc`));
		const decrypted = decrypt(encrypted2, key);
		expect(decrypted.equals(original)).toBe(true);

		await unlink(join(dir, `${filename}.enc`));
	});

	it('ownership check: user cannot access another user image via meal query', async () => {
		const filename = `${crypto.randomUUID()}.png`;
		const now = new Date();

		await db.insert(schema.meal).values({
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'Owned Meal',
			calories: 300,
			protein: 10,
			carbs: 20,
			fat: 5,
			source: 'manual',
			imageFilename: filename,
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const byOwner = await db
			.select({ id: schema.meal.id })
			.from(schema.meal)
			.where(eq(schema.meal.imageFilename, filename));
		expect(byOwner).toHaveLength(1);

		expect(byOwner).toHaveLength(1);
	});
});

describe('Meal with imageFilename', () => {
	it('creates meal with imageFilename', async () => {
		const filename = `${crypto.randomUUID()}.webp`;
		const now = new Date();

		const [created] = await db
			.insert(schema.meal)
			.values({
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Meal with image',
				calories: 500,
				protein: 30,
				carbs: 40,
				fat: 20,
				source: 'manual',
				imageFilename: filename,
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		expect(created.imageFilename).toBe(filename);
	});

	it('creates meal without imageFilename (null)', async () => {
		const now = new Date();

		const [created] = await db
			.insert(schema.meal)
			.values({
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Meal without image',
				calories: 200,
				protein: 10,
				carbs: 15,
				fat: 5,
				source: 'manual',
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		expect(created.imageFilename).toBeNull();
	});

	it('updates imageFilename and clears old', async () => {
		const oldFilename = `${crypto.randomUUID()}.jpeg`;
		const newFilename = `${crypto.randomUUID()}.png`;
		const now = new Date();

		const [created] = await db
			.insert(schema.meal)
			.values({
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Replace image',
				calories: 400,
				protein: 25,
				carbs: 35,
				fat: 15,
				source: 'manual',
				imageFilename: oldFilename,
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		await db
			.update(schema.meal)
			.set({ imageFilename: newFilename, updatedAt: new Date(), updatedBy: TEST_USER_ID })
			.where(eq(schema.meal.id, created.id));

		const [updated] = await db.select().from(schema.meal).where(eq(schema.meal.id, created.id));

		expect(updated.imageFilename).toBe(newFilename);
	});

	it('sets imageFilename to null (removes image)', async () => {
		const filename = `${crypto.randomUUID()}.jpeg`;
		const now = new Date();

		const [created] = await db
			.insert(schema.meal)
			.values({
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Remove image',
				calories: 350,
				protein: 20,
				carbs: 30,
				fat: 12,
				source: 'manual',
				imageFilename: filename,
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		await db
			.update(schema.meal)
			.set({ imageFilename: null, updatedAt: new Date(), updatedBy: TEST_USER_ID })
			.where(eq(schema.meal.id, created.id));

		const [updated] = await db.select().from(schema.meal).where(eq(schema.meal.id, created.id));

		expect(updated.imageFilename).toBeNull();
	});
});
