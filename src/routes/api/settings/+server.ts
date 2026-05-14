import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants';
import { addLogContext } from '$lib/server/logger';
import type { RequestHandler } from './$types';

const MASKED_KEY = 'sk-****';
const MAX_PROMPT_LENGTH = 2000;

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const GOALS = ['lose', 'maintain', 'gain'] as const;

function maskApiKey(key: string | null): string | null {
	if (!key) return null;
	if (key.length <= 6) return MASKED_KEY;
	return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

function validateNonNegativeInt(value: unknown, _fieldName: string): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined;
	return value;
}

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const result = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, user.id))
		.limit(1);

	const row = result[0];
	if (!row) {
		return json({
			dailyCalorieGoal: DEFAULT_CALORIE_GOAL,
			dailyProteinGoal: null,
			dailyCarbsGoal: null,
			dailyFatGoal: null,
			aiEndpointUrl: null,
			aiApiKey: null,
			aiModel: null,
			aiSystemPrompt: null,
			age: null,
			weight: null,
			height: null,
			activityLevel: null,
			goal: null
		});
	}

	addLogContext(locals, { settingsLoaded: true });

	return json({
		dailyCalorieGoal: row.dailyCalorieGoal,
		dailyProteinGoal: row.dailyProteinGoal,
		dailyCarbsGoal: row.dailyCarbsGoal,
		dailyFatGoal: row.dailyFatGoal,
		aiEndpointUrl: row.aiEndpointUrl,
		aiApiKey: maskApiKey(row.aiApiKey),
		aiModel: row.aiModel,
		aiSystemPrompt: row.aiSystemPrompt,
		age: row.age,
		weight: row.weight,
		height: row.height,
		activityLevel: row.activityLevel,
		goal: row.goal
	});
};

interface SettingsBody {
	dailyCalorieGoal?: unknown;
	dailyProteinGoal?: unknown;
	dailyCarbsGoal?: unknown;
	dailyFatGoal?: unknown;
	aiEndpointUrl?: unknown;
	aiApiKey?: unknown;
	aiModel?: unknown;
	aiSystemPrompt?: unknown;
	age?: unknown;
	weight?: unknown;
	height?: unknown;
	activityLevel?: unknown;
	goal?: unknown;
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = body as SettingsBody;

	if (
		typeof parsed.dailyCalorieGoal !== 'number' ||
		!Number.isInteger(parsed.dailyCalorieGoal) ||
		parsed.dailyCalorieGoal < 0
	) {
		return json({ error: 'dailyCalorieGoal must be a non-negative integer' }, { status: 400 });
	}

	if (parsed.dailyProteinGoal !== undefined) {
		if (
			typeof parsed.dailyProteinGoal !== 'number' ||
			!Number.isInteger(parsed.dailyProteinGoal) ||
			parsed.dailyProteinGoal < 0
		) {
			return json({ error: 'dailyProteinGoal must be a non-negative integer' }, { status: 400 });
		}
	}

	if (parsed.dailyCarbsGoal !== undefined) {
		if (
			typeof parsed.dailyCarbsGoal !== 'number' ||
			!Number.isInteger(parsed.dailyCarbsGoal) ||
			parsed.dailyCarbsGoal < 0
		) {
			return json({ error: 'dailyCarbsGoal must be a non-negative integer' }, { status: 400 });
		}
	}

	if (parsed.dailyFatGoal !== undefined) {
		if (
			typeof parsed.dailyFatGoal !== 'number' ||
			!Number.isInteger(parsed.dailyFatGoal) ||
			parsed.dailyFatGoal < 0
		) {
			return json({ error: 'dailyFatGoal must be a non-negative integer' }, { status: 400 });
		}
	}

	if (
		parsed.aiEndpointUrl !== undefined &&
		parsed.aiEndpointUrl !== null &&
		parsed.aiEndpointUrl !== ''
	) {
		if (typeof parsed.aiEndpointUrl !== 'string') {
			return json({ error: 'aiEndpointUrl must be a string' }, { status: 400 });
		}
		try {
			new URL(parsed.aiEndpointUrl);
		} catch {
			return json({ error: 'aiEndpointUrl must be a valid URL' }, { status: 400 });
		}
	}

	if (
		parsed.aiModel !== undefined &&
		parsed.aiModel !== null &&
		parsed.aiModel !== '' &&
		typeof parsed.aiModel !== 'string'
	) {
		return json({ error: 'aiModel must be a string' }, { status: 400 });
	}

	if (parsed.aiSystemPrompt !== undefined && parsed.aiSystemPrompt !== null) {
		if (typeof parsed.aiSystemPrompt !== 'string') {
			return json({ error: 'aiSystemPrompt must be a string' }, { status: 400 });
		}
		if (parsed.aiSystemPrompt.length > MAX_PROMPT_LENGTH) {
			return json(
				{ error: `aiSystemPrompt must be at most ${MAX_PROMPT_LENGTH} characters` },
				{ status: 400 }
			);
		}
	}

	if (parsed.age !== undefined && parsed.age !== null) {
		if (
			typeof parsed.age !== 'number' ||
			!Number.isInteger(parsed.age) ||
			parsed.age < 10 ||
			parsed.age > 120
		) {
			return json({ error: 'age must be an integer between 10 and 120' }, { status: 400 });
		}
	}

	if (parsed.weight !== undefined && parsed.weight !== null) {
		if (
			typeof parsed.weight !== 'number' ||
			!Number.isInteger(parsed.weight) ||
			parsed.weight < 20 ||
			parsed.weight > 500
		) {
			return json({ error: 'weight must be an integer between 20 and 500' }, { status: 400 });
		}
	}

	if (parsed.height !== undefined && parsed.height !== null) {
		if (
			typeof parsed.height !== 'number' ||
			!Number.isInteger(parsed.height) ||
			parsed.height < 50 ||
			parsed.height > 300
		) {
			return json({ error: 'height must be an integer between 50 and 300' }, { status: 400 });
		}
	}

	if (parsed.activityLevel !== undefined && parsed.activityLevel !== null) {
		if (
			typeof parsed.activityLevel !== 'string' ||
			!ACTIVITY_LEVELS.includes(parsed.activityLevel as (typeof ACTIVITY_LEVELS)[number])
		) {
			return json(
				{ error: 'activityLevel must be one of: sedentary, light, moderate, active, very_active' },
				{ status: 400 }
			);
		}
	}

	if (parsed.goal !== undefined && parsed.goal !== null) {
		if (typeof parsed.goal !== 'string' || !GOALS.includes(parsed.goal as (typeof GOALS)[number])) {
			return json({ error: 'goal must be one of: lose, maintain, gain' }, { status: 400 });
		}
	}

	const existing = await db
		.select({ id: userSettings.id, aiApiKey: userSettings.aiApiKey })
		.from(userSettings)
		.where(eq(userSettings.userId, user.id))
		.limit(1);

	const endpointUrl =
		parsed.aiEndpointUrl === '' || parsed.aiEndpointUrl === null
			? null
			: ((parsed.aiEndpointUrl as string | undefined) ?? null);

	const apiKeyRaw = parsed.aiApiKey;
	const apiKey =
		apiKeyRaw === MASKED_KEY
			? (existing[0]?.aiApiKey ?? null)
			: apiKeyRaw === '' || apiKeyRaw === null
				? null
				: typeof apiKeyRaw === 'string'
					? apiKeyRaw
					: null;

	const model =
		parsed.aiModel === '' || parsed.aiModel === null
			? null
			: ((parsed.aiModel as string | undefined) ?? null);

	const proteinGoal =
		parsed.dailyProteinGoal === null
			? null
			: (validateNonNegativeInt(parsed.dailyProteinGoal, 'dailyProteinGoal') ?? null);
	const carbsGoal =
		parsed.dailyCarbsGoal === null
			? null
			: (validateNonNegativeInt(parsed.dailyCarbsGoal, 'dailyCarbsGoal') ?? null);
	const fatGoal =
		parsed.dailyFatGoal === null
			? null
			: (validateNonNegativeInt(parsed.dailyFatGoal, 'dailyFatGoal') ?? null);

	const systemPrompt =
		parsed.aiSystemPrompt === '' || parsed.aiSystemPrompt === null
			? null
			: ((parsed.aiSystemPrompt as string | undefined) ?? null);

	const age = parsed.age === null ? null : (validateNonNegativeInt(parsed.age, 'age') ?? undefined);
	const weight =
		parsed.weight === null ? null : (validateNonNegativeInt(parsed.weight, 'weight') ?? undefined);
	const height =
		parsed.height === null ? null : (validateNonNegativeInt(parsed.height, 'height') ?? undefined);
	const activityLevel =
		parsed.activityLevel === '' || parsed.activityLevel === null
			? null
			: ((parsed.activityLevel as string | undefined) ?? null);
	const profileGoal =
		parsed.goal === '' || parsed.goal === null
			? null
			: ((parsed.goal as string | undefined) ?? null);

	if (existing.length > 0) {
		await db
			.update(userSettings)
			.set({
				dailyCalorieGoal: parsed.dailyCalorieGoal,
				dailyProteinGoal: proteinGoal,
				dailyCarbsGoal: carbsGoal,
				dailyFatGoal: fatGoal,
				aiEndpointUrl: endpointUrl,
				aiApiKey: apiKey,
				aiModel: model,
				aiSystemPrompt: systemPrompt,
				age: age ?? undefined,
				weight: weight ?? undefined,
				height: height ?? undefined,
				activityLevel,
				goal: profileGoal,
				updatedAt: new Date(),
				updatedBy: user.id
			})
			.where(eq(userSettings.id, existing[0].id));
	} else {
		await db.insert(userSettings).values({
			userId: user.id,
			dailyCalorieGoal: parsed.dailyCalorieGoal,
			dailyProteinGoal: proteinGoal,
			dailyCarbsGoal: carbsGoal,
			dailyFatGoal: fatGoal,
			aiEndpointUrl: endpointUrl,
			aiApiKey: apiKey,
			aiModel: model,
			aiSystemPrompt: systemPrompt,
			age: age ?? null,
			weight: weight ?? null,
			height: height ?? null,
			activityLevel,
			goal: profileGoal,
			createdBy: user.id,
			updatedBy: user.id
		});
	}

	addLogContext(locals, { settingsUpdated: true });

	return json({
		dailyCalorieGoal: parsed.dailyCalorieGoal,
		dailyProteinGoal: proteinGoal,
		dailyCarbsGoal: carbsGoal,
		dailyFatGoal: fatGoal,
		aiEndpointUrl: endpointUrl,
		aiApiKey: maskApiKey(apiKey),
		aiModel: model,
		aiSystemPrompt: systemPrompt,
		age: age ?? null,
		weight: weight ?? null,
		height: height ?? null,
		activityLevel,
		goal: profileGoal
	});
};
