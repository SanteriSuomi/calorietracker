import { json } from '@sveltejs/kit';
import { addLogContext } from '$lib/server/logger';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024;
const EXT_MAP: Record<string, string> = {
	'image/jpeg': 'jpeg',
	'image/png': 'png',
	'image/webp': 'webp'
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Invalid form data' }, { status: 400 });
	}

	const imageField = formData.get('image');
	if (!imageField || !(imageField instanceof File)) {
		return json({ error: 'Missing image field' }, { status: 400 });
	}

	if (imageField.size > MAX_SIZE) {
		return json({ error: 'File too large (max 5MB)' }, { status: 400 });
	}

	if (!ALLOWED_TYPES.has(imageField.type)) {
		return json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP' }, { status: 400 });
	}

	const ext = EXT_MAP[imageField.type];
	const filename = `${crypto.randomUUID()}.${ext}`;
	const buffer = Buffer.from(await imageField.arrayBuffer());

	await storage.save(user.id, filename, buffer);

	addLogContext(locals, { imageFilename: filename, imageSize: imageField.size });

	return json({ filename }, { status: 201 });
};
