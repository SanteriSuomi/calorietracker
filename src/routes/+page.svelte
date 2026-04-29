<script lang="ts">
	import CalorieDoughnut from '$lib/components/CalorieDoughnut.svelte';
		import DateNav from '$lib/components/DateNav.svelte';
		import MacroSummary from '$lib/components/MacroSummary.svelte';
		import MealList from '$lib/components/MealList.svelte';
		import { formatDate } from '$lib/utils/date';
		import type { PageData } from './$types';

		let { data }: { data: PageData } = $props();

		const totals = $derived(
			data.meals.reduce(
				(acc: { calories: number; protein: number; carbs: number; fat: number }, m) => ({
					calories: acc.calories + m.calories,
					protein: acc.protein + m.protein,
					carbs: acc.carbs + m.carbs,
					fat: acc.fat + m.fat
				}),
				{ calories: 0, protein: 0, carbs: 0, fat: 0 }
			)
		);

		const formattedDate = $derived(formatDate(data.date));
</script>

<svelte:head>
	<title>{formattedDate} — CalorieTracker</title>
</svelte:head>

<DateNav date={data.date} />

<div class="flex justify-center py-4">
	<CalorieDoughnut eaten={totals.calories} goal={data.dailyCalorieGoal} />
</div>

<MacroSummary protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />

<MealList meals={data.meals} />
