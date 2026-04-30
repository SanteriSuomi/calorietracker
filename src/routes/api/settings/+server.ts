import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants';
import { addLogContext } from '$lib/server/logger';
import type { RequestHandler } from './$types';

const MASKED_KEY = 'sk-****';

function maskApiKey(key: string | null): string | null {
	if (!key) return null;
	if (key.length <= 6) return MASKED_KEY;
	return `${key.slice(0, 3)}...${key.slice(-4)}`;
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
			aiEndpointUrl: null,
			aiApiKey: null,
			aiModel: null
		});
	}

	addLogContext(locals, { settingsLoaded: true });

	return json({
		dailyCalorieGoal: row.dailyCalorieGoal,
		aiEndpointUrl: row.aiEndpointUrl,
		aiApiKey: maskApiKey(row.aiApiKey),
		aiModel: row.aiModel
	});
};

interface SettingsBody {
	dailyCalorieGoal?: unknown;
	aiEndpointUrl?: unknown;
	aiApiKey?: unknown;
	aiModel?: unknown;
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

	if (existing.length > 0) {
		await db
			.update(userSettings)
			.set({
				dailyCalorieGoal: parsed.dailyCalorieGoal,
				aiEndpointUrl: endpointUrl,
				aiApiKey: apiKey,
				aiModel: model,
				updatedAt: new Date(),
				updatedBy: user.id
			})
			.where(eq(userSettings.id, existing[0].id));
	} else {
		await db.insert(userSettings).values({
			userId: user.id,
			dailyCalorieGoal: parsed.dailyCalorieGoal,
			aiEndpointUrl: endpointUrl,
			aiApiKey: apiKey,
			aiModel: model,
			createdBy: user.id,
			updatedBy: user.id
		});
	}

	addLogContext(locals, { settingsUpdated: true });

	return json({
		dailyCalorieGoal: parsed.dailyCalorieGoal,
		aiEndpointUrl: endpointUrl,
		aiApiKey: maskApiKey(apiKey),
		aiModel: model
	});
};
