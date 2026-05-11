import { createOpenAI } from '@ai-sdk/openai';
import { json } from '@sveltejs/kit';
import { generateText } from 'ai';
import type { RequestHandler } from './$types';

interface TestBody {
	aiEndpointUrl?: unknown;
	aiApiKey?: unknown;
	aiModel?: unknown;
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

	const parsed = body as TestBody;

	if (
		typeof parsed.aiEndpointUrl !== 'string' ||
		!parsed.aiEndpointUrl.trim() ||
		typeof parsed.aiApiKey !== 'string' ||
		!parsed.aiApiKey.trim() ||
		typeof parsed.aiModel !== 'string' ||
		!parsed.aiModel.trim()
	) {
		return json({ error: 'Endpoint URL, API Key, and Model are required.' }, { status: 400 });
	}

	const start = Date.now();

	try {
		const provider = createOpenAI({
			baseURL: parsed.aiEndpointUrl.trim(),
			apiKey: parsed.aiApiKey.trim()
		});

		const { text } = await generateText({
			model: provider.chat(parsed.aiModel.trim()),
			prompt: 'Reply with exactly one word: OK',
			maxOutputTokens: 10
		});

		const latency = Date.now() - start;

		return json({
			success: true,
			latency_ms: latency,
			model: parsed.aiModel.trim(),
			response: text.trim()
		});
	} catch (error) {
		const latency = Date.now() - start;
		return json({
			success: false,
			latency_ms: latency,
			model: parsed.aiModel.trim(),
			error: error instanceof Error ? error.message : String(error)
		});
	}
};
