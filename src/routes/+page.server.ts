import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { meal, userSettings } from '$lib/server/db/schema';
import {
	DEFAULT_CALORIE_GOAL,
	DEFAULT_CARBS_GOAL,
	DEFAULT_FAT_GOAL,
	DEFAULT_PROTEIN_GOAL
} from '$lib/server/db/shared/constants';
import type { Meal } from '$lib/types';
import { isValidDate, today } from '$lib/utils/date';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = locals.user;
	if (!user)
		return {
			meals: [] as Meal[],
			date: today(),
			dailyCalorieGoal: DEFAULT_CALORIE_GOAL,
			dailyProteinGoal: DEFAULT_PROTEIN_GOAL,
			dailyCarbsGoal: DEFAULT_CARBS_GOAL,
			dailyFatGoal: DEFAULT_FAT_GOAL,
			aiConfigured: false
		};

	const raw = url.searchParams.get('date');
	let date = raw && isValidDate(raw) ? raw : today();
	if (date > today()) date = today();

	const [mealsResult, settingsResult] = await Promise.all([
		db
			.select({
				id: meal.id,
				description: meal.description,
				calories: meal.calories,
				protein: meal.protein,
				carbs: meal.carbs,
				fat: meal.fat,
				source: meal.source,
				imageFilename: meal.imageFilename
			})
			.from(meal)
			.where(and(eq(meal.userId, user.id), eq(meal.date, date))),
		db
			.select({
				dailyCalorieGoal: userSettings.dailyCalorieGoal,
				dailyProteinGoal: userSettings.dailyProteinGoal,
				dailyCarbsGoal: userSettings.dailyCarbsGoal,
				dailyFatGoal: userSettings.dailyFatGoal,
				aiEndpointUrl: userSettings.aiEndpointUrl,
				aiApiKey: userSettings.aiApiKey,
				aiModel: userSettings.aiModel
			})
			.from(userSettings)
			.where(eq(userSettings.userId, user.id))
			.limit(1)
	]);

	const settingsRow = settingsResult[0];

	return {
		meals: mealsResult as Meal[],
		date,
		dailyCalorieGoal: settingsRow?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL,
		dailyProteinGoal: settingsRow?.dailyProteinGoal ?? DEFAULT_PROTEIN_GOAL,
		dailyCarbsGoal: settingsRow?.dailyCarbsGoal ?? DEFAULT_CARBS_GOAL,
		dailyFatGoal: settingsRow?.dailyFatGoal ?? DEFAULT_FAT_GOAL,
		aiConfigured: !!(settingsRow?.aiEndpointUrl && settingsRow?.aiApiKey && settingsRow?.aiModel)
	};
};
