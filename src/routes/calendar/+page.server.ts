import { and, between, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { meal, userSettings } from '$lib/server/db/schema';
import { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants';
import type { DaySummary } from '$lib/types';
import { addDays, addMonths, endOfMonth, startOfMonth, today } from '$lib/utils/date';
import type { PageServerLoad } from './$types';

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseDaySummaryRows(
	rows: { date: string; calories: number; protein: number; carbs: number; fat: number }[]
): Record<string, DaySummary> {
	const map: Record<string, DaySummary> = {};
	for (const row of rows) {
		map[row.date] = {
			date: row.date,
			calories: Number(row.calories),
			protein: Number(row.protein),
			carbs: Number(row.carbs),
			fat: Number(row.fat)
		};
	}
	return map;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) {
		return {
			gridData: {},
			listData: [],
			currentMonth: today().slice(0, 7),
			dailyCalorieGoal: DEFAULT_CALORIE_GOAL
		};
	}

	const raw = url.searchParams.get('month');
	const currentMonth = raw && MONTH_RE.test(raw) ? raw : today().slice(0, 7);
	const maxMonth = today().slice(0, 7);
	const effectiveMonth = currentMonth > maxMonth ? maxMonth : currentMonth;

	const gridStart = startOfMonth(addMonths(`${effectiveMonth}-01`, -1));
	const gridEnd = endOfMonth(addMonths(`${effectiveMonth}-01`, 1));

	const listEnd = today();
	const listStart = addDays(listEnd, -89);

	const [gridRows, listRows, settingsResult] = await Promise.all([
		db
			.select({
				date: meal.date,
				calories: sql<number>`cast(sum(${meal.calories}) as integer)`,
				protein: sql<number>`cast(sum(${meal.protein}) as integer)`,
				carbs: sql<number>`cast(sum(${meal.carbs}) as integer)`,
				fat: sql<number>`cast(sum(${meal.fat}) as integer)`
			})
			.from(meal)
			.where(and(eq(meal.userId, user.id), between(meal.date, gridStart, gridEnd)))
			.groupBy(meal.date)
			.orderBy(meal.date),

		db
			.select({
				date: meal.date,
				calories: sql<number>`cast(sum(${meal.calories}) as integer)`,
				protein: sql<number>`cast(sum(${meal.protein}) as integer)`,
				carbs: sql<number>`cast(sum(${meal.carbs}) as integer)`,
				fat: sql<number>`cast(sum(${meal.fat}) as integer)`
			})
			.from(meal)
			.where(and(eq(meal.userId, user.id), between(meal.date, listStart, listEnd)))
			.groupBy(meal.date)
			.orderBy(desc(meal.date)),

		db
			.select({ dailyCalorieGoal: userSettings.dailyCalorieGoal })
			.from(userSettings)
			.where(eq(userSettings.userId, user.id))
			.limit(1)
	]);

	return {
		gridData: parseDaySummaryRows(gridRows),
		listData: listRows.map((r) => ({
			date: r.date,
			calories: Number(r.calories),
			protein: Number(r.protein),
			carbs: Number(r.carbs),
			fat: Number(r.fat)
		})) as DaySummary[],
		currentMonth: effectiveMonth,
		dailyCalorieGoal: settingsResult[0]?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL
	};
};
