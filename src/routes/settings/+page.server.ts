import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import {
	DEFAULT_AI_SYSTEM_PROMPT,
	DEFAULT_CALORIE_GOAL,
	DEFAULT_CARBS_GOAL,
	DEFAULT_FAT_GOAL,
	DEFAULT_PROTEIN_GOAL
} from '$lib/server/db/shared/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user)
		return {
			dailyCalorieGoal: DEFAULT_CALORIE_GOAL,
			dailyProteinGoal: DEFAULT_PROTEIN_GOAL,
			dailyCarbsGoal: DEFAULT_CARBS_GOAL,
			dailyFatGoal: DEFAULT_FAT_GOAL,
			aiEndpointUrl: '',
			aiApiKey: '',
			aiModel: '',
			aiSystemPrompt: '',
			email: ''
		};

	const result = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, user.id))
		.limit(1);

	const row = result[0];
	return {
		dailyCalorieGoal: row?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL,
		dailyProteinGoal: row?.dailyProteinGoal ?? DEFAULT_PROTEIN_GOAL,
		dailyCarbsGoal: row?.dailyCarbsGoal ?? DEFAULT_CARBS_GOAL,
		dailyFatGoal: row?.dailyFatGoal ?? DEFAULT_FAT_GOAL,
		aiEndpointUrl: row?.aiEndpointUrl ?? '',
		aiApiKey: row?.aiApiKey ? 'sk-****' : '',
		aiModel: row?.aiModel ?? '',
		aiSystemPrompt: row?.aiSystemPrompt ?? '',
		email: user.email
	};
};
