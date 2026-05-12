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

const SYSTEM_PROMPT_VISION =
	'You are a nutrition estimation assistant. Analyze the provided food photo (and optional description) to estimate the nutritional content for a typical serving. Return a JSON object with: description (cleaned-up food name), calories (kcal), protein (grams), carbs (grams), fat (grams). All numeric values must be non-negative integers. If the input is ambiguous, estimate for a standard portion.';

const nutritionSchema = z.object({
	description: z.string(),
	calories: z.number().int().nonnegative(),
	protein: z.number().int().nonnegative(),
	carbs: z.number().int().nonnegative(),
	fat: z.number().int().nonnegative()
});

async function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
	const arrayBuffer = await file.arrayBuffer();
	const uint8 = new Uint8Array(arrayBuffer);
	let binary = '';
	for (let i = 0; i < uint8.length; i++) {
		binary += String.fromCharCode(uint8[i]);
	}
	const base64 = btoa(binary);
	return { base64, mediaType: file.type || 'image/jpeg' };
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const contentType = request.headers.get('content-type') ?? '';
	let description: string | undefined;
	let imageFile: File | undefined;

	if (contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		const descField = formData.get('description');
		if (typeof descField === 'string' && descField.trim()) {
			description = descField.trim();
		}
		const imageField = formData.get('image');
		if (imageField instanceof File && imageField.size > 0) {
			imageFile = imageField;
		}
	} else {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, { status: 400 });
		}
		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			return json({ error: 'Invalid JSON' }, { status: 400 });
		}
		const parsed = body as { description?: unknown };
		if (typeof parsed.description === 'string' && parsed.description.trim()) {
			description = parsed.description.trim();
		}
	}

	if (!description && !imageFile) {
		return json({ error: 'description or image is required' }, { status: 400 });
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

	const aiSource = imageFile ? (description ? 'ai_text_vision' : 'ai_vision') : 'ai_text';
	const systemPrompt = (settings.aiSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;

	try {
		const provider = createOpenAI({
			baseURL: settings.aiEndpointUrl,
			apiKey: settings.aiApiKey
		});

		let aiCallParams: Parameters<typeof generateText>[0];

		if (imageFile) {
			const { base64, mediaType } = await readFileAsBase64(imageFile);
			const contentParts: Array<
				{ type: 'text'; text: string } | { type: 'file'; mediaType: string; data: string }
			> = [];
			if (description) {
				contentParts.push({ type: 'text', text: description });
			}
			contentParts.push({ type: 'file', mediaType, data: base64 });

			aiCallParams = {
				model: provider(settings.aiModel),
				output: Output.object({ schema: nutritionSchema }),
				system: SYSTEM_PROMPT_VISION,
				messages: [{ role: 'user', content: contentParts }]
			};
		} else {
			aiCallParams = {
				model: provider(settings.aiModel),
				output: Output.object({ schema: nutritionSchema }),
				system: systemPrompt,
				prompt: description!
			};
		}

		const { output } = await generateText(aiCallParams);

		addLogContext(locals, { aiSource, aiModel: settings.aiModel });

		return json(output);
	} catch (error) {
		if (NoObjectGeneratedError.isInstance(error)) {
			addLogContext(locals, {
				aiSource,
				aiModel: settings.aiModel,
				error: 'invalid_response'
			});
			return json({ error: 'AI returned invalid response' }, { status: 502 });
		}

		addLogContext(locals, {
			aiSource,
			aiModel: settings.aiModel,
			error: error instanceof Error ? error.message : 'unknown'
		});
		return json({ error: error instanceof Error ? error.message : 'AI service error' }, { status: 502 });
	}
};
