import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) return { dailyCalorieGoal: DEFAULT_CALORIE_GOAL, aiEndpointUrl: '', aiApiKey: '', aiModel: '', email: '' };

	const result = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, user.id))
		.limit(1);

	const row = result[0];
	return {
		dailyCalorieGoal: row?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL,
		aiEndpointUrl: row?.aiEndpointUrl ?? '',
		aiApiKey: row?.aiApiKey ? 'sk-****' : '',
		aiModel: row?.aiModel ?? '',
		email: user.email
	};
};
