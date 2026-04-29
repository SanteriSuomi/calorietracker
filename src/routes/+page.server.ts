import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { meal, userSettings } from '$lib/server/db/schema';
import { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants';
import type { Meal } from '$lib/types';
import { isValidDate, today } from '$lib/utils/date';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) return { meals: [] as Meal[], date: today(), dailyCalorieGoal: DEFAULT_CALORIE_GOAL };

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
				source: meal.source
			})
			.from(meal)
			.where(and(eq(meal.userId, user.id), eq(meal.date, date))),
		db
			.select({ dailyCalorieGoal: userSettings.dailyCalorieGoal })
			.from(userSettings)
			.where(eq(userSettings.userId, user.id))
			.limit(1)
	]);

	return {
		meals: mealsResult as Meal[],
		date,
		dailyCalorieGoal: settingsResult[0]?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL
	};
};
