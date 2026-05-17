import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

function auditColumns() {
	return {
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		createdBy: text('created_by').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedBy: text('updated_by').notNull()
	};
}

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', {
			withTimezone: true,
			mode: 'date'
		}),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
			withTimezone: true,
			mode: 'date'
		}),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	meals: many(meal),
	userSettings: many(userSettings)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}));

export const meal = pgTable(
	'meal',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		description: text('description').notNull(),
		calories: integer('calories').notNull(),
		protein: integer('protein').notNull(),
		carbs: integer('carbs').notNull(),
		fat: integer('fat').notNull(),
		imageFilename: text('image_filename'),
		source: text('source').notNull(),
		...auditColumns()
	},
	(table) => [index('meal_userId_date_idx').on(table.userId, table.date)]
);

export const userSettings = pgTable(
	'user_settings',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		dailyCalorieGoal: integer('daily_calorie_goal').notNull().default(2000),
		dailyProteinGoal: integer('daily_protein_goal'),
		dailyCarbsGoal: integer('daily_carbs_goal'),
		dailyFatGoal: integer('daily_fat_goal'),
		aiEndpointUrl: text('ai_endpoint_url'),
		aiApiKey: text('ai_api_key'),
		aiModel: text('ai_model'),
		aiSystemPrompt: text('ai_system_prompt'),
		age: integer('age'),
		weight: integer('weight'),
		height: integer('height'),
		activityLevel: text('activity_level'),
		goal: text('goal'),
		...auditColumns()
	},
	(table) => [uniqueIndex('user_settings_userId_key').on(table.userId)]
);

export const mealRelations = relations(meal, ({ one }) => ({
	user: one(user, {
		fields: [meal.userId],
		references: [user.id]
	})
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
	user: one(user, {
		fields: [userSettings.userId],
		references: [user.id]
	})
}));

export const rateLimits = pgTable('rate_limits', {
	ip: text('ip').notNull(),
	windowStart: timestamp('window_start', { withTimezone: true, mode: 'date' }).notNull(),
	count: integer('count').notNull().default(1)
});
