import { execSync } from 'node:child_process';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/pg/schema';

const CONTAINER_NAME = 'ct-test-pg';
const PG_PORT = 5433;
const PG_URL = `postgresql://postgres:postgres@localhost:${PG_PORT}/calorietracker`;

let pool: Pool;
let db: ReturnType<typeof drizzle>;

const TEST_USER_ID = 'pg-test-user-1';

async function waitForPostgres(maxAttempts = 30, intervalMs = 500): Promise<void> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const testPool = new Pool({ connectionString: PG_URL, ssl: false });
			await testPool.query('SELECT 1');
			await testPool.end();
			return;
		} catch {
			await new Promise((r) => setTimeout(r, intervalMs));
		}
	}
	throw new Error(`PostgreSQL not ready after ${(maxAttempts * intervalMs) / 1000}s`);
}

beforeAll(async () => {
	execSync(
		`docker run -d --name ${CONTAINER_NAME} ` +
			`-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres ` +
			`-e POSTGRES_DB=calorietracker ` +
			`-p ${PG_PORT}:5432 postgres:16-alpine`,
		{ stdio: 'pipe' }
	);

	await waitForPostgres();

	pool = new Pool({ connectionString: PG_URL, ssl: false });
	db = drizzle({ client: pool, schema });

	await migrate(db, { migrationsFolder: './drizzle/pg' });

	await db.insert(schema.user).values({
		id: TEST_USER_ID,
		name: 'PG Test User',
		email: 'pg-test@example.com',
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});
}, 30_000);

afterAll(async () => {
	await pool?.end();
	try {
		execSync(`docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME}`, {
			stdio: 'pipe'
		});
	} catch {
		// container may already be gone
	}
});

describe('PG schema — meals', () => {
	it('inserts and reads a meal', async () => {
		const mealId = crypto.randomUUID();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'PG Chicken & Rice',
			calories: 450,
			protein: 35,
			carbs: 50,
			fat: 12,
			source: 'manual',
			createdBy: TEST_USER_ID,
			updatedBy: TEST_USER_ID
		});

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal).toBeDefined();
		expect(meal.description).toBe('PG Chicken & Rice');
		expect(meal.calories).toBe(450);
		expect(meal.protein).toBe(35);
		expect(meal.carbs).toBe(50);
		expect(meal.fat).toBe(12);
		expect(meal.source).toBe('manual');
		expect(meal.imageFilename).toBeNull();
	});

	it('inserts a meal with imageFilename', async () => {
		const mealId = crypto.randomUUID();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'PG Shake',
			calories: 200,
			protein: 30,
			carbs: 10,
			fat: 5,
			imageFilename: '1712850000000.enc',
			source: 'ai_vision',
			createdBy: TEST_USER_ID,
			updatedBy: TEST_USER_ID
		});

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.imageFilename).toBe('1712850000000.enc');
		expect(meal.source).toBe('ai_vision');
	});

	it('auto-generates UUID for id if not provided', async () => {
		const [inserted] = await db
			.insert(schema.meal)
			.values({
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'PG Salad',
				calories: 150,
				protein: 10,
				carbs: 20,
				fat: 5,
				source: 'manual',
				createdBy: TEST_USER_ID,
				updatedBy: TEST_USER_ID
			})
			.returning();

		expect(inserted.id).toBeTruthy();
		expect(inserted.id.length).toBeGreaterThan(0);
	});

	it('deletes a meal', async () => {
		const mealId = crypto.randomUUID();

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
			createdBy: TEST_USER_ID,
			updatedBy: TEST_USER_ID
		});

		await db.delete(schema.meal).where(eq(schema.meal.id, mealId));

		const result = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(result).toHaveLength(0);
	});
});

describe('PG schema — userSettings', () => {
	it('inserts and reads user settings', async () => {
		const userId = 'pg-settings-user';
		await db.insert(schema.user).values({
			id: userId,
			name: 'PG Settings User',
			email: 'pg-settings@example.com',
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		await db.insert(schema.userSettings).values({
			userId,
			dailyCalorieGoal: 2200,
			dailyProteinGoal: 150,
			dailyCarbsGoal: 250,
			dailyFatGoal: 70,
			aiEndpointUrl: 'https://api.openai.com/v1',
			aiApiKey: 'sk-test-key',
			aiModel: 'gpt-4o',
			createdBy: userId,
			updatedBy: userId
		});

		const [settings] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(settings).toBeDefined();
		expect(settings.dailyCalorieGoal).toBe(2200);
		expect(settings.dailyProteinGoal).toBe(150);
		expect(settings.aiEndpointUrl).toBe('https://api.openai.com/v1');
		expect(settings.aiModel).toBe('gpt-4o');
	});

	it('defaults dailyCalorieGoal to 2000', async () => {
		const userId = 'pg-defaults-user';
		await db.insert(schema.user).values({
			id: userId,
			name: 'PG Defaults User',
			email: 'pg-defaults@example.com',
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		await db.insert(schema.userSettings).values({
			userId,
			createdBy: userId,
			updatedBy: userId
		});

		const [settings] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(settings.dailyCalorieGoal).toBe(2000);
		expect(settings.dailyProteinGoal).toBeNull();
		expect(settings.aiEndpointUrl).toBeNull();
	});

	it('enforces unique userId', async () => {
		const userId = 'pg-unique-user';
		await db.insert(schema.user).values({
			id: userId,
			name: 'PG Unique User',
			email: 'pg-unique@example.com',
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		await db.insert(schema.userSettings).values({
			userId,
			createdBy: userId,
			updatedBy: userId
		});

		await expect(
			db.insert(schema.userSettings).values({
				userId,
				createdBy: userId,
				updatedBy: userId
			})
		).rejects.toThrow();
	});
});

describe('PG schema — audit fields', () => {
	it('auto-populates createdAt/updatedAt and stores createdBy/updatedBy', async () => {
		const mealId = crypto.randomUUID();

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
			createdBy: TEST_USER_ID,
			updatedBy: TEST_USER_ID
		});

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.createdAt).toBeInstanceOf(Date);
		expect(meal.updatedAt).toBeInstanceOf(Date);
		expect(meal.createdBy).toBe(TEST_USER_ID);
		expect(meal.updatedBy).toBe(TEST_USER_ID);
	});
});
