import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/sqlite/schema';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

const TEST_USER_ID = 'test-user-account-delete';

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle/sqlite' });
});

afterAll(async () => {
	client.close();
});

describe('Account deletion — cascade cleanup', () => {
	it('deletes user and cascades to meals and settings', async () => {
		const now = new Date();

		await db.insert(schema.user).values({
			id: TEST_USER_ID,
			name: 'Delete Me',
			email: 'delete@example.com',
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.userSettings).values({
			userId: TEST_USER_ID,
			dailyCalorieGoal: 2000,
			age: 25,
			weight: 70,
			height: 175,
			activityLevel: 'moderate',
			goal: 'maintain',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		await db.insert(schema.meal).values({
			userId: TEST_USER_ID,
			date: '2026-01-15',
			description: 'Test meal',
			calories: 500,
			protein: 30,
			carbs: 50,
			fat: 15,
			source: 'manual',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const settingsBefore = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));
		expect(settingsBefore.length).toBe(1);
		expect(settingsBefore[0].activityLevel).toBe('moderate');

		const mealsBefore = await db
			.select()
			.from(schema.meal)
			.where(eq(schema.meal.userId, TEST_USER_ID));
		expect(mealsBefore.length).toBe(1);

		await db.delete(schema.meal).where(eq(schema.meal.userId, TEST_USER_ID));
		await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, TEST_USER_ID));
		await db.delete(schema.user).where(eq(schema.user.id, TEST_USER_ID));

		const userAfter = await db.select().from(schema.user).where(eq(schema.user.id, TEST_USER_ID));
		expect(userAfter.length).toBe(0);

		const settingsAfter = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));
		expect(settingsAfter.length).toBe(0);

		const mealsAfter = await db
			.select()
			.from(schema.meal)
			.where(eq(schema.meal.userId, TEST_USER_ID));
		expect(mealsAfter.length).toBe(0);
	});

	it('handles deletion of user with no meals or settings', async () => {
		const now = new Date();
		const userId = 'test-user-empty-delete';

		await db.insert(schema.user).values({
			id: userId,
			name: 'Empty User',
			email: 'empty-delete@example.com',
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.delete(schema.user).where(eq(schema.user.id, userId));

		const userAfter = await db.select().from(schema.user).where(eq(schema.user.id, userId));
		expect(userAfter.length).toBe(0);
	});
});
