import { createOpenAI } from '@ai-sdk/openai';
import { json } from '@sveltejs/kit';
import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { extractJsonFromResponse } from '$lib/server/ai-helpers';
import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import { addLogContext } from '$lib/server/logger';
import { aiCallCounter } from '$lib/server/metrics';
import type { RequestHandler } from './$types';

const SYSTEM_PROMPT =
	'You are a nutrition and fitness assistant. Given a user profile (age, weight in kg, height in cm, ' +
	'activity level, and goal), estimate their Total Daily Energy Expenditure (TDEE) and recommend daily ' +
	'macro targets. Activity levels: sedentary (little/no exercise), light (1-3 days/week), moderate ' +
	'(3-5 days/week), active (6-7 days/week), very_active (intense daily). Goals: lose (500 kcal deficit), ' +
	'maintain (TDEE), gain (300-500 kcal surplus). Return calories (kcal) and macros (protein, carbs, fat ' +
	'in grams) as non-negative integers. Also provide a brief explanation of the calculation.\n\n' +
	'You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with exactly these fields: ' +
	'{ "calories": number, "protein": number, "carbs": number, "fat": number, "explanation": string }. ' +
	'All numeric values must be non-negative integers.';

const goalEstimateSchema = z.object({
	calories: z.number().int().positive(),
	protein: z.number().int().positive(),
	carbs: z.number().int().positive(),
	fat: z.number().int().positive(),
	explanation: z.string()
});

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const GOALS = ['lose', 'maintain', 'gain'] as const;

interface EstimateBody {
	age?: unknown;
	weight?: unknown;
	height?: unknown;
	activityLevel?: unknown;
	goal?: unknown;
}

export const POST: RequestHandler = async ({ request, locals }) => {
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

	const parsed = body as EstimateBody;

	if (
		typeof parsed.age !== 'number' ||
		!Number.isInteger(parsed.age) ||
		parsed.age < 10 ||
		parsed.age > 120
	) {
		return json({ error: 'age must be an integer between 10 and 120' }, { status: 400 });
	}

	if (
		typeof parsed.weight !== 'number' ||
		!Number.isInteger(parsed.weight) ||
		parsed.weight < 20 ||
		parsed.weight > 500
	) {
		return json({ error: 'weight must be an integer between 20 and 500' }, { status: 400 });
	}

	if (
		typeof parsed.height !== 'number' ||
		!Number.isInteger(parsed.height) ||
		parsed.height < 50 ||
		parsed.height > 300
	) {
		return json({ error: 'height must be an integer between 50 and 300' }, { status: 400 });
	}

	if (
		typeof parsed.activityLevel !== 'string' ||
		!ACTIVITY_LEVELS.includes(parsed.activityLevel as (typeof ACTIVITY_LEVELS)[number])
	) {
		return json(
			{ error: 'activityLevel must be one of: sedentary, light, moderate, active, very_active' },
			{ status: 400 }
		);
	}

	if (typeof parsed.goal !== 'string' || !GOALS.includes(parsed.goal as (typeof GOALS)[number])) {
		return json({ error: 'goal must be one of: lose, maintain, gain' }, { status: 400 });
	}

	const settingsResult = await db
		.select({
			aiEndpointUrl: userSettings.aiEndpointUrl,
			aiApiKey: userSettings.aiApiKey,
			aiModel: userSettings.aiModel
		})
		.from(userSettings)
		.where(eq(userSettings.userId, user.id))
		.limit(1);

	const row = settingsResult[0];
	const endpointUrl = row?.aiEndpointUrl || env.AI_DEFAULT_ENDPOINT || null;
	const apiKey = row?.aiApiKey || env.AI_DEFAULT_API_KEY || null;
	const model = row?.aiModel || env.AI_DEFAULT_MODEL || null;

	if (!endpointUrl || !apiKey || !model) {
		return json({ error: 'AI not configured. Go to Settings to configure.' }, { status: 400 });
	}

	try {
		const provider = createOpenAI({
			baseURL: endpointUrl,
			apiKey
		});

		const userMessage = `Age: ${parsed.age}, Weight: ${parsed.weight}kg, Height: ${parsed.height}cm, Activity: ${parsed.activityLevel}, Goal: ${parsed.goal}`;

		const { text } = await generateText({
			model: provider.chat(model),
			system: SYSTEM_PROMPT,
			prompt: userMessage
		});

		const raw = extractJsonFromResponse(text);
		const output = goalEstimateSchema.parse(raw);

		addLogContext(locals, { aiSource: 'goal_estimate', aiModel: model });
		aiCallCounter.inc({ source: 'goal_estimate', model, status: 'success' });

		return json(output);
	} catch (error) {
		addLogContext(locals, {
			aiSource: 'goal_estimate',
			aiModel: model,
			error: error instanceof Error ? error.message : 'unknown'
		});
		aiCallCounter.inc({ source: 'goal_estimate', model, status: 'error' });
		return json({ error: 'AI service error' }, { status: 502 });
	}
};
