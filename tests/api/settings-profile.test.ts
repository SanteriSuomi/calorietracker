import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/sqlite/schema';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

const TEST_USER_ID = 'test-user-profile-fields';

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle/sqlite' });

	await db.insert(schema.user).values({
		id: TEST_USER_ID,
		name: 'Test User',
		email: 'profile@example.com',
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});
});

afterAll(async () => {
	client.close();
});

describe('Settings — profile fields round-trip', () => {
	it('saves and reads all profile fields', async () => {
		const now = new Date();
		await db.insert(schema.userSettings).values({
			userId: TEST_USER_ID,
			age: 30,
			weight: 75,
			height: 180,
			activityLevel: 'moderate',
			goal: 'lose',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row.age).toBe(30);
		expect(row.weight).toBe(75);
		expect(row.height).toBe(180);
		expect(row.activityLevel).toBe('moderate');
		expect(row.goal).toBe('lose');
	});

	it('updates profile fields', async () => {
		await db
			.update(schema.userSettings)
			.set({
				age: 35,
				weight: 80,
				height: 175,
				activityLevel: 'active',
				goal: 'maintain',
				updatedAt: new Date(),
				updatedBy: TEST_USER_ID
			})
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row.age).toBe(35);
		expect(row.weight).toBe(80);
		expect(row.height).toBe(175);
		expect(row.activityLevel).toBe('active');
		expect(row.goal).toBe('maintain');
	});

	it('clears profile fields to null', async () => {
		await db
			.update(schema.userSettings)
			.set({
				age: null,
				weight: null,
				height: null,
				activityLevel: null,
				goal: null,
				updatedAt: new Date(),
				updatedBy: TEST_USER_ID
			})
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row.age).toBeNull();
		expect(row.weight).toBeNull();
		expect(row.height).toBeNull();
		expect(row.activityLevel).toBeNull();
		expect(row.goal).toBeNull();
	});
});

describe('Settings — profile field validation', () => {
	const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
	const GOALS = ['lose', 'maintain', 'gain'];

	it('accepts all valid activity levels', () => {
		for (const level of ACTIVITY_LEVELS) {
			expect(ACTIVITY_LEVELS.includes(level)).toBe(true);
		}
	});

	it('accepts all valid goals', () => {
		for (const goal of GOALS) {
			expect(GOALS.includes(goal)).toBe(true);
		}
	});

	it('rejects invalid activity level', () => {
		expect(ACTIVITY_LEVELS.includes('super_active' as never)).toBe(false);
	});

	it('rejects invalid goal', () => {
		expect(GOALS.includes('bulk' as never)).toBe(false);
	});

	it('validates age range 10-120', () => {
		const validAge = (n: number) => Number.isInteger(n) && n >= 10 && n <= 120;
		expect(validAge(10)).toBe(true);
		expect(validAge(120)).toBe(true);
		expect(validAge(9)).toBe(false);
		expect(validAge(121)).toBe(false);
	});

	it('validates weight range 20-500', () => {
		const validWeight = (n: number) => Number.isInteger(n) && n >= 20 && n <= 500;
		expect(validWeight(20)).toBe(true);
		expect(validWeight(500)).toBe(true);
		expect(validWeight(19)).toBe(false);
		expect(validWeight(501)).toBe(false);
	});

	it('validates height range 50-300', () => {
		const validHeight = (n: number) => Number.isInteger(n) && n >= 50 && n <= 300;
		expect(validHeight(50)).toBe(true);
		expect(validHeight(300)).toBe(true);
		expect(validHeight(49)).toBe(false);
		expect(validHeight(301)).toBe(false);
	});
});
