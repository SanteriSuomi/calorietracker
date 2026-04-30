import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { meal } from '$lib/server/db/schema';
import { addLogContext } from '$lib/server/logger';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const MIME_MAP: Record<string, string> = {
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
};

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const filename = params.filename;

	const owned = await db
		.select({ id: meal.id })
		.from(meal)
		.where(and(eq(meal.imageFilename, filename), eq(meal.userId, user.id)))
		.limit(1);

	if (owned.length === 0) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	try {
		const buffer = await storage.read(user.id, filename);
		const ext = filename.split('.').pop() ?? '';
		const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

		addLogContext(locals, { imageFilename: filename });

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'private, max-age=86400'
			}
		});
	} catch {
		return json({ error: 'Image not found' }, { status: 404 });
	}
};
