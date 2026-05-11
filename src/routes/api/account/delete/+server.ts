import { json } from '@sveltejs/kit';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { meal, user, userSettings } from '$lib/server/db/schema';
import { addLogContext } from '$lib/server/logger';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const userRecord = locals.user;
	if (!userRecord) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const mealsWithImages = await db
			.select({ imageFilename: meal.imageFilename })
			.from(meal)
			.where(and(eq(meal.userId, userRecord.id), isNotNull(meal.imageFilename)));

		for (const m of mealsWithImages) {
			if (m.imageFilename) {
				try {
					await storage.remove(userRecord.id, m.imageFilename);
				} catch {
					// continue even if individual file removal fails
				}
			}
		}

		try {
			await storage.removeAll(userRecord.id);
		} catch {
			// continue even if directory cleanup fails
		}

		await db.delete(meal).where(eq(meal.userId, userRecord.id));
		await db.delete(userSettings).where(eq(userSettings.userId, userRecord.id));
		await db.delete(user).where(eq(user.id, userRecord.id));

		addLogContext(locals, { accountDeleted: true });

		return json({ success: true });
	} catch (error) {
		addLogContext(locals, {
			error: error instanceof Error ? error.message : 'unknown',
			accountDeletionFailed: true
		});
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};
