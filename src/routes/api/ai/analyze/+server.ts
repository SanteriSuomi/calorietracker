import { createOpenAI } from '@ai-sdk/openai';
import { json } from '@sveltejs/kit';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import { AI_FORMAT_SUFFIX, DEFAULT_AI_SYSTEM_PROMPT } from '$lib/server/db/shared/constants';
import { addLogContext } from '$lib/server/logger';
import type { RequestHandler } from './$types';

const nutritionSchema = z.object({
	description: z.string(),
	calories: z.number().int().nonnegative(),
	protein: z.number().int().nonnegative(),
	carbs: z.number().int().nonnegative(),
	fat: z.number().int().nonnegative()
});

interface AnalyzeBody {
	description?: unknown;
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

	const parsed = body as AnalyzeBody;
	if (typeof parsed.description !== 'string' || parsed.description.trim() === '') {
		return json({ error: 'description is required' }, { status: 400 });
	}

	const settingsResult = await db
		.select({
			aiEndpointUrl: userSettings.aiEndpointUrl,
			aiApiKey: userSettings.aiApiKey,
			aiModel: userSettings.aiModel,
			aiSystemPrompt: userSettings.aiSystemPrompt
		})
		.from(userSettings)
		.where(eq(userSettings.userId, user.id))
		.limit(1);

	const settings = settingsResult[0];
	if (!settings?.aiEndpointUrl || !settings?.aiApiKey || !settings?.aiModel) {
		return json({ error: 'AI not configured. Go to Settings to configure.' }, { status: 400 });
	}

	const systemPrompt = (settings.aiSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;

	try {
		const provider = createOpenAI({
			baseURL: settings.aiEndpointUrl,
			apiKey: settings.aiApiKey
		});

		const { output } = await generateText({
			model: provider(settings.aiModel),
			output: Output.object({ schema: nutritionSchema }),
			system: systemPrompt,
			prompt: parsed.description.trim()
		});

		addLogContext(locals, { aiSource: 'ai_text', aiModel: settings.aiModel });

		return json(output);
	} catch (error) {
		if (NoObjectGeneratedError.isInstance(error)) {
			addLogContext(locals, {
				aiSource: 'ai_text',
				aiModel: settings.aiModel,
				error: 'invalid_response'
			});
			return json({ error: 'AI returned invalid response' }, { status: 502 });
		}

		addLogContext(locals, {
			aiSource: 'ai_text',
			aiModel: settings.aiModel,
			error: error instanceof Error ? error.message : 'unknown'
		});
		return json({ error: 'AI service error' }, { status: 502 });
	}
};
