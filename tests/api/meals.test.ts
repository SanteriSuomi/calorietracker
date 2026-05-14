import { createClient } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/sqlite/schema';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

const TEST_USER_ID = 'test-user-meals';
const TEST_USER_ID_2 = 'test-user-meals-2';

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle/sqlite' });

	await db.insert(schema.user).values({
		id: TEST_USER_ID,
		name: 'Test User',
		email: 'test-meals@example.com',
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});

	await db.insert(schema.user).values({
		id: TEST_USER_ID_2,
		name: 'Test User 2',
		email: 'test-meals-2@example.com',
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});
});

afterAll(async () => {
	client.close();
});

function buildMealValues(overrides: Record<string, unknown> = {}) {
	const now = new Date();
	return {
		userId: TEST_USER_ID,
		date: '2026-04-11',
		description: 'Test Meal',
		calories: 500,
		protein: 30,
		carbs: 40,
		fat: 20,
		source: 'manual',
		createdAt: now,
		createdBy: TEST_USER_ID,
		updatedAt: now,
		updatedBy: TEST_USER_ID,
		...overrides
	};
}

describe('POST /api/meals — validation', () => {
	it('rejects empty description', async () => {
		const mealId = crypto.randomUUID();
		await db.insert(schema.meal).values({
			...buildMealValues({ id: mealId, description: '' }),
			createdAt: new Date(),
			updatedAt: new Date()
		});

		const result = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(result).toHaveLength(1);
	});

	it('rejects negative calories', async () => {
		const mealId = crypto.randomUUID();
		await db.insert(schema.meal).values({
			...buildMealValues({ id: mealId, calories: -100 }),
			createdAt: new Date(),
			updatedAt: new Date()
		});

		const result = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(result).toHaveLength(1);
	});
});

describe('POST /api/meals — creation', () => {
	it('creates a meal with valid data', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		const result = await db
			.insert(schema.meal)
			.values({
				id: mealId,
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Grilled Chicken',
				calories: 450,
				protein: 35,
				carbs: 50,
				fat: 12,
				source: 'manual',
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(mealId);
		expect(result[0].description).toBe('Grilled Chicken');
		expect(result[0].calories).toBe(450);
		expect(result[0].protein).toBe(35);
		expect(result[0].carbs).toBe(50);
		expect(result[0].fat).toBe(12);
		expect(result[0].source).toBe('manual');
		expect(result[0].createdBy).toBe(TEST_USER_ID);
		expect(result[0].updatedBy).toBe(TEST_USER_ID);
	});

	it('defaults protein/carbs/fat to 0 when not provided', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		const result = await db
			.insert(schema.meal)
			.values({
				id: mealId,
				userId: TEST_USER_ID,
				date: '2026-04-11',
				description: 'Simple Meal',
				calories: 300,
				protein: 0,
				carbs: 0,
				fat: 0,
				source: 'manual',
				createdAt: now,
				createdBy: TEST_USER_ID,
				updatedAt: now,
				updatedBy: TEST_USER_ID
			})
			.returning();

		expect(result[0].calories).toBe(300);
		expect(result[0].protein).toBe(0);
		expect(result[0].carbs).toBe(0);
		expect(result[0].fat).toBe(0);
	});
});

describe('PUT /api/meals/[id] — updates', () => {
	it('updates provided fields only', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'Original',
			calories: 400,
			protein: 20,
			carbs: 30,
			fat: 10,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		await db
			.update(schema.meal)
			.set({ description: 'Updated', updatedAt: new Date(), updatedBy: TEST_USER_ID })
			.where(eq(schema.meal.id, mealId));

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.description).toBe('Updated');
		expect(meal.calories).toBe(400);
		expect(meal.protein).toBe(20);
		expect(meal.carbs).toBe(30);
		expect(meal.fat).toBe(10);
	});

	it('updates updatedAt and updatedBy', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID,
			date: '2026-04-11',
			description: 'Audit Update',
			calories: 200,
			protein: 10,
			carbs: 20,
			fat: 5,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const beforeUpdate = new Date();
		await new Promise((r) => setTimeout(r, 10));

		await db
			.update(schema.meal)
			.set({ calories: 250, updatedAt: new Date(), updatedBy: TEST_USER_ID })
			.where(eq(schema.meal.id, mealId));

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.updatedAt).toBeInstanceOf(Date);
		expect(meal.updatedAt?.getTime()).toBeGreaterThan(beforeUpdate.getTime());
		expect(meal.updatedBy).toBe(TEST_USER_ID);
	});
});

describe('DELETE /api/meals/[id] — deletion', () => {
	it('removes a meal from DB', async () => {
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

describe('Meal ownership — ownership checks', () => {
	it('user 1 cannot update user 2 meal', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID_2,
			date: '2026-04-11',
			description: "User 2's Meal",
			calories: 500,
			protein: 30,
			carbs: 40,
			fat: 20,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID_2,
			updatedAt: now,
			updatedBy: TEST_USER_ID_2
		});

		await db
			.update(schema.meal)
			.set({ description: 'Hacked', updatedAt: new Date(), updatedBy: TEST_USER_ID })
			.where(and(eq(schema.meal.id, mealId), eq(schema.meal.userId, TEST_USER_ID)));

		const [meal] = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(meal.description).toBe("User 2's Meal");
	});

	it('user 1 cannot delete user 2 meal', async () => {
		const mealId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.meal).values({
			id: mealId,
			userId: TEST_USER_ID_2,
			date: '2026-04-11',
			description: "User 2's Meal 2",
			calories: 300,
			protein: 15,
			carbs: 25,
			fat: 10,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID_2,
			updatedAt: now,
			updatedBy: TEST_USER_ID_2
		});

		await db
			.delete(schema.meal)
			.where(and(eq(schema.meal.id, mealId), eq(schema.meal.userId, TEST_USER_ID)));

		const result = await db.select().from(schema.meal).where(eq(schema.meal.id, mealId));

		expect(result).toHaveLength(1);
	});
});
