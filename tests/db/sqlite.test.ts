import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/sqlite/schema';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

const TEST_USER_ID = 'test-user-1';

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle/sqlite' });

	await db.insert(schema.user).values({
		id: TEST_USER_ID,
		name: 'Test User',
		email: 'test@example.com',
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});
});

afterAll(async () => {
	client.close();
});

describe('SQLite schema — meals', () => {
	it('inserts and reads a meal', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'Chicken & Rice',
			calories: 450,
			protein: 35,
			carbs: 50,
			fat: 12,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal).toBeDefined();
		expect(meal.description).toBe('Chicken & Rice');
		expect(meal.calories).toBe(450);
		expect(meal.protein).toBe(35);
		expect(meal.carbs).toBe(50);
		expect(meal.fat).toBe(12);
		expect(meal.source).toBe('manual');
		expect(meal.imageFilename).toBeNull();
	});

	it('inserts a meal with imageFilename', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'Protein Shake',
			calories: 200,
			protein: 30,
			carbs: 10,
			fat: 5,
			imageFilename: '1712850000000.enc',
			source: 'ai_vision',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.imageFilename).toBe('1712850000000.enc');
		expect(meal.source).toBe('ai_vision');
	});

	it('auto-generates UUID for id if not provided', async () => {
		const now = new Date();

		const [inserted] = await db
			.insert(schema.meal)
			.values({
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Salad',
				calories: 150,
				protein: 10,
				carbs: 20,
				fat: 5,
				source: 'manual',
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		expect(inserted.id).toBeTruthy();
		expect(inserted.id.length).toBeGreaterThan(0);
	});

	it('deletes a meal', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'To Delete',
			calories: 100,
			protein: 5,
			carbs: 10,
			fat: 3,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		await db.delete(schema.meal).where(eq(schema.meal.id, mealId));

		const result = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(result).toHaveLength(0);
	});
});

describe('SQLite schema — userSettings', () => {
	it('inserts and reads user settings', async () => {
		const settingsId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.userSettings).values({
			id: settingsId,
			userId: TEST_USER_ID,
			dailyCalorieGoal: 2200,
			dailyProteinGoal: 150,
			dailyCarbsGoal: 250,
			dailyFatGoal: 70,
			aiEndpointUrl: 'https://api.openai.com/v1',
			aiApiKey: 'sk-test-key',
			aiModel: 'gpt-4o',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const [settings] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(settings).toBeDefined();
		expect(settings.dailyCalorieGoal).toBe(2200);
		expect(settings.dailyProteinGoal).toBe(150);
		expect(settings.dailyCarbsGoal).toBe(250);
		expect(settings.dailyFatGoal).toBe(70);
		expect(settings.aiEndpointUrl).toBe('https://api.openai.com/v1');
		expect(settings.aiApiKey).toBe('sk-test-key');
		expect(settings.aiModel).toBe('gpt-4o');
	});

	it('defaults dailyCalorieGoal to 2000', async () => {
		const userId = 'test-user-defaults';
		const now = new Date();

		await db.insert(schema.user).values({
			id: userId,
			name: 'Defaults User',
			email: 'defaults@example.com',
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.userSettings).values({
			userId,
			createdAt: now,
			createdBy: userId,
			updatedAt: now,
			updatedBy: userId
		});

		const [settings] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(settings.dailyCalorieGoal).toBe(2000);
		expect(settings.dailyProteinGoal).toBeNull();
		expect(settings.dailyCarbsGoal).toBeNull();
		expect(settings.dailyFatGoal).toBeNull();
		expect(settings.aiEndpointUrl).toBeNull();
		expect(settings.aiApiKey).toBeNull();
		expect(settings.aiModel).toBeNull();
	});

	it('enforces unique userId', async () => {
		const userId = 'test-user-unique';
		const now = new Date();

		await db.insert(schema.user).values({
			id: userId,
			name: 'Unique User',
			email: 'unique@example.com',
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.userSettings).values({
			userId,
			createdAt: now,
			createdBy: userId,
			updatedAt: now,
			updatedBy: userId
		});

		await expect(
			db.insert(schema.userSettings).values({
				userId,
				createdAt: now,
				createdBy: userId,
				updatedAt: now,
				updatedBy: userId
			})
		).rejects.toThrow();
	});
});

describe('SQLite schema — audit fields', () => {
	it('populates createdAt and updatedAt on meal', async () => {
		const mealId = crypto.randomUUID();
		const beforeInsert = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'Audit Test',
			calories: 100,
			protein: 5,
			carbs: 10,
			fat: 3,
			source: 'manual',
			createdAt: beforeInsert,
			createdBy: TEST_USER_ID,
			updatedAt: beforeInsert,
			updatedBy: TEST_USER_ID
		});

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.createdAt).toBeInstanceOf(Date);
		expect(meal.updatedAt).toBeInstanceOf(Date);
		expect(meal.createdBy).toBe(TEST_USER_ID);
		expect(meal.updatedBy).toBe(TEST_USER_ID);
	});
});
