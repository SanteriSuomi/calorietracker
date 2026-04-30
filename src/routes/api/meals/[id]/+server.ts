import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { meal } from '$lib/server/db/schema';
import { addLogContext } from '$lib/server/logger';
import { storage } from '$lib/server/storage';
import { isValidDate, today } from '$lib/utils/date';
import type { RequestHandler } from './$types';

interface UpdateBody {
	description?: unknown;
	calories?: unknown;
	protein?: unknown;
	carbs?: unknown;
	fat?: unknown;
	date?: unknown;
	imageFilename?: unknown;
}

async function getOwnedMeal(id: string, userId: string) {
	const result = await db
		.select()
		.from(meal)
		.where(and(eq(meal.id, id), eq(meal.userId, userId)))
		.limit(1);
	return result[0] ?? null;
}

export const PUT: RequestHandler = async ({ request, params, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const existing = await getOwnedMeal(params.id, user.id);
	if (!existing) {
		return json({ error: 'Meal not found' }, { status: 404 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const update: Record<string, unknown> = {};

	const parsed = body as UpdateBody;

	if (parsed.description !== undefined) {
		if (typeof parsed.description !== 'string' || parsed.description.trim() === '') {
			return json({ error: 'Description must be a non-empty string' }, { status: 400 });
		}
		update.description = parsed.description.trim();
	}

	if (parsed.calories !== undefined) {
		const cal = parsed.calories;
		if (typeof cal !== 'number' || !Number.isInteger(cal) || cal < 0) {
			return json({ error: 'Calories must be a non-negative integer' }, { status: 400 });
		}
		update.calories = cal;
	}

	if (parsed.protein !== undefined) {
		const p = parsed.protein;
		if (typeof p !== 'number' || !Number.isInteger(p) || p < 0) {
			return json({ error: 'Protein must be a non-negative integer' }, { status: 400 });
		}
		update.protein = p;
	}

	if (parsed.carbs !== undefined) {
		const c = parsed.carbs;
		if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) {
			return json({ error: 'Carbs must be a non-negative integer' }, { status: 400 });
		}
		update.carbs = c;
	}

	if (parsed.fat !== undefined) {
		const f = parsed.fat;
		if (typeof f !== 'number' || !Number.isInteger(f) || f < 0) {
			return json({ error: 'Fat must be a non-negative integer' }, { status: 400 });
		}
		update.fat = f;
	}

	if (parsed.date !== undefined) {
		if (typeof parsed.date !== 'string' || !isValidDate(parsed.date)) {
			return json({ error: 'Date must be in YYYY-MM-DD format' }, { status: 400 });
		}
		if (parsed.date > today()) {
			return json({ error: 'Date cannot be in the future' }, { status: 400 });
		}
		update.date = parsed.date;
	}

	if (parsed.imageFilename !== undefined) {
		if (parsed.imageFilename !== null && typeof parsed.imageFilename !== 'string') {
			return json({ error: 'imageFilename must be a string or null' }, { status: 400 });
		}
		if (existing.imageFilename && existing.imageFilename !== parsed.imageFilename) {
			try {
				await storage.remove(user.id, existing.imageFilename);
			} catch {
				/* log only */
			}
		}
		update.imageFilename = parsed.imageFilename;
	}

	if (Object.keys(update).length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	update.updatedAt = new Date();
	update.updatedBy = user.id;

	const updated = await db.update(meal).set(update).where(eq(meal.id, params.id)).returning();

	const mealRow = updated[0];

	addLogContext(locals, { mealId: params.id });

	return json(mealRow, { status: 200 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const existing = await getOwnedMeal(params.id, user.id);
	if (!existing) {
		return json({ error: 'Meal not found' }, { status: 404 });
	}

	if (existing.imageFilename) {
		try {
			await storage.remove(user.id, existing.imageFilename);
		} catch {
			/* log only */
		}
	}

	await db.delete(meal).where(eq(meal.id, params.id));

	addLogContext(locals, { mealId: params.id });

	return new Response(null, { status: 204 });
};
