import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { meal } from '$lib/server/db/schema';
import { addLogContext } from '$lib/server/logger';
import { isValidDate, today } from '$lib/utils/date';
import type { RequestHandler } from './$types';

interface MealBody {
	description?: unknown;
	calories?: unknown;
	protein?: unknown;
	carbs?: unknown;
	fat?: unknown;
	date?: unknown;
	imageFilename?: unknown;
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

	const parsed = body as MealBody;
	const fields: Record<string, string> = {};

	const description = parsed.description;
	if (typeof description !== 'string' || description.trim() === '') {
		fields.description = 'Description is required';
	}

	const calories = parsed.calories;
	if (typeof calories !== 'number' || !Number.isInteger(calories) || calories < 0) {
		fields.calories = 'Calories must be a non-negative integer';
	}

	const protein = parsed.protein;
	const proteinVal =
		typeof protein === 'number' && Number.isInteger(protein) && protein >= 0 ? protein : 0;

	const carbs = parsed.carbs;
	const carbsVal = typeof carbs === 'number' && Number.isInteger(carbs) && carbs >= 0 ? carbs : 0;

	const fat = parsed.fat;
	const fatVal = typeof fat === 'number' && Number.isInteger(fat) && fat >= 0 ? fat : 0;

	const date = parsed.date;
	let dateVal: string;
	if (typeof date === 'string' && isValidDate(date)) {
		dateVal = date;
	} else {
		dateVal = today();
	}

	if (dateVal > today()) {
		fields.date = 'Date cannot be in the future';
	}

	if (Object.keys(fields).length > 0) {
		return json({ error: 'Validation failed', fields }, { status: 400 });
	}

	const descVal = description as string;
	const calVal = calories as number;

	let imageFilenameVal: string | null = null;
	if (parsed.imageFilename !== undefined) {
		if (typeof parsed.imageFilename !== 'string') {
			return json({ error: 'imageFilename must be a string' }, { status: 400 });
		}
		imageFilenameVal = parsed.imageFilename;
	}

	const created = await db
		.insert(meal)
		.values({
			userId: user.id,
			date: dateVal,
			description: descVal.trim(),
			calories: calVal,
			protein: proteinVal,
			carbs: carbsVal,
			fat: fatVal,
			source: 'manual',
			imageFilename: imageFilenameVal,
			createdBy: user.id,
			updatedBy: user.id
		})
		.returning();

	const mealRow = created[0];

	addLogContext(locals, { mealId: mealRow.id, source: 'manual' });

	return json(mealRow, { status: 201 });
};
