import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/sqlite/schema';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

const TEST_USER_ID = 'test-user-settings';

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle/sqlite' });

	await db.insert(schema.user).values({
		id: TEST_USER_ID,
		name: 'Test User',
		email: 'settings@example.com',
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});
});

afterAll(async () => {
	client.close();
});

describe('Settings — insert (first save)', () => {
	it('creates settings row with valid data', async () => {
		const now = new Date();
		await db.insert(schema.userSettings).values({
			userId: TEST_USER_ID,
			dailyCalorieGoal: 2200,
			aiEndpointUrl: 'https://api.openai.com/v1',
			aiApiKey: 'sk-test-key-12345',
			aiModel: 'gpt-4o',
			createdAt: now,
			createdBy: TEST_USER_ID,
			updatedAt: now,
			updatedBy: TEST_USER_ID
		});

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row).toBeDefined();
		expect(row.dailyCalorieGoal).toBe(2200);
		expect(row.aiEndpointUrl).toBe('https://api.openai.com/v1');
		expect(row.aiApiKey).toBe('sk-test-key-12345');
		expect(row.aiModel).toBe('gpt-4o');
	});
});

describe('Settings — update', () => {
	it('updates existing settings row', async () => {
		await db
			.update(schema.userSettings)
			.set({
				dailyCalorieGoal: 2500,
				aiModel: 'gpt-4o-mini',
				updatedAt: new Date(),
				updatedBy: TEST_USER_ID
			})
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row.dailyCalorieGoal).toBe(2500);
		expect(row.aiModel).toBe('gpt-4o-mini');
		expect(row.aiEndpointUrl).toBe('https://api.openai.com/v1');
	});

	it('preserves API key when not updating it', async () => {
		await db
			.update(schema.userSettings)
			.set({
				dailyCalorieGoal: 1800,
				updatedAt: new Date(),
				updatedBy: TEST_USER_ID
			})
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row.aiApiKey).toBe('sk-test-key-12345');
	});

	it('updates API key when new value provided', async () => {
		await db
			.update(schema.userSettings)
			.set({
				aiApiKey: 'sk-new-key-67890',
				updatedAt: new Date(),
				updatedBy: TEST_USER_ID
			})
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, TEST_USER_ID));

		expect(row.aiApiKey).toBe('sk-new-key-67890');
	});
});

describe('Settings — API key masking logic', () => {
	it('maskApiKey returns null for null', () => {
		const maskApiKey = (key: string | null): string | null => {
			if (!key) return null;
			if (key.length <= 6) return 'sk-****';
			return `${key.slice(0, 3)}...${key.slice(-4)}`;
		};
		expect(maskApiKey(null)).toBe(null);
	});

	it('maskApiKey masks short keys', () => {
		const maskApiKey = (key: string | null): string | null => {
			if (!key) return null;
			if (key.length <= 6) return 'sk-****';
			return `${key.slice(0, 3)}...${key.slice(-4)}`;
		};
		expect(maskApiKey('sk-abc')).toBe('sk-****');
	});

	it('maskApiKey masks long keys showing first 3 and last 4', () => {
		const maskApiKey = (key: string | null): string | null => {
			if (!key) return null;
			if (key.length <= 6) return 'sk-****';
			return `${key.slice(0, 3)}...${key.slice(-4)}`;
		};
		expect(maskApiKey('sk-test-key-12345')).toBe('sk-...2345');
	});
});

describe('Settings — defaults', () => {
	it('defaults dailyCalorieGoal to 2000', async () => {
		const userId = 'test-user-defaults-settings';
		const now = new Date();

		await db.insert(schema.user).values({
			id: userId,
			name: 'Defaults User',
			email: 'defaults-settings@example.com',
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

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(row.dailyCalorieGoal).toBe(2000);
		expect(row.aiEndpointUrl).toBeNull();
		expect(row.aiApiKey).toBeNull();
		expect(row.aiModel).toBeNull();
		expect(row.dailyProteinGoal).toBeNull();
		expect(row.dailyCarbsGoal).toBeNull();
		expect(row.dailyFatGoal).toBeNull();
		expect(row.aiSystemPrompt).toBeNull();
	});
});

describe('Settings — macro goals round-trip', () => {
	it('saves and reads macro goals', async () => {
		const userId = 'test-user-macro-goals';
		const now = new Date();

		await db.insert(schema.user).values({
			id: userId,
			name: 'Macro Goals User',
			email: 'macro-goals@example.com',
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.userSettings).values({
			userId,
			dailyProteinGoal: 180,
			dailyCarbsGoal: 300,
			dailyFatGoal: 70,
			createdAt: now,
			createdBy: userId,
			updatedAt: now,
			updatedBy: userId
		});

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(row.dailyProteinGoal).toBe(180);
		expect(row.dailyCarbsGoal).toBe(300);
		expect(row.dailyFatGoal).toBe(70);
	});

	it('updates macro goals to null', async () => {
		const userId = 'test-user-macro-goals';

		await db
			.update(schema.userSettings)
			.set({
				dailyProteinGoal: null,
				dailyCarbsGoal: null,
				dailyFatGoal: null,
				updatedAt: new Date(),
				updatedBy: userId
			})
			.where(eq(schema.userSettings.userId, userId));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(row.dailyProteinGoal).toBeNull();
		expect(row.dailyCarbsGoal).toBeNull();
		expect(row.dailyFatGoal).toBeNull();
	});
});

describe('Settings — system prompt round-trip', () => {
	it('saves and reads custom system prompt', async () => {
		const userId = 'test-user-system-prompt';
		const now = new Date();

		await db.insert(schema.user).values({
			id: userId,
			name: 'Prompt User',
			email: 'prompt@example.com',
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.userSettings).values({
			userId,
			aiSystemPrompt: 'You are a helpful nutritionist.',
			createdAt: now,
			createdBy: userId,
			updatedAt: now,
			updatedBy: userId
		});

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(row.aiSystemPrompt).toBe('You are a helpful nutritionist.');
	});

	it('clears system prompt to null', async () => {
		const userId = 'test-user-system-prompt';

		await db
			.update(schema.userSettings)
			.set({
				aiSystemPrompt: null,
				updatedAt: new Date(),
				updatedBy: userId
			})
			.where(eq(schema.userSettings.userId, userId));

		const [row] = await db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, userId));

		expect(row.aiSystemPrompt).toBeNull();
	});
});
