<script lang="ts">
	import { goto } from '$app/navigation';
		import { Input } from '$lib/components/ui/input';
		import { m } from '$lib/paraglide/messages';
		import { localizeHref } from '$lib/paraglide/runtime';
		import type { DaySummary } from '$lib/types';
		import { formatDate } from '$lib/utils/date';

		let {
			days,
			dailyCalorieGoal = 2000
		}: {
			days: DaySummary[];
			dailyCalorieGoal?: number;
		} = $props();

		let filterText = $state('');

		let filteredDays = $derived(
			filterText.trim()
				? days.filter(
						(d) =>
							d.date.includes(filterText.trim()) ||
							formatDate(d.date).toLowerCase().includes(filterText.trim().toLowerCase())
					)
				: days
		);
</script>

<div class="mb-3">
	<Input
		type="text"
		placeholder={m.calendar_filter_placeholder()}
		bind:value={filterText}
	/>
</div>

<div class="max-h-[70vh] overflow-y-auto divide-y divide-border rounded-lg border">
	{#each filteredDays as day (day.date)}
		<button
			type="button"
			class="flex w-full items-center justify-between px-4 py-3 text-left
				hover:bg-muted/50 transition-colors"
			onclick={() => goto(localizeHref('/') + `?date=${day.date}`)}
		>
			<div class="text-left">
				<p class="text-sm font-medium">{formatDate(day.date)}</p>
				<p class="text-xs text-muted-foreground">
					{m.calendar_macro_summary({ protein: day.protein, carbs: day.carbs, fat: day.fat })}
				</p>
			</div>
			<div class="text-right">
				<p class="font-semibold">{day.calories}</p>
				<p class="text-xs text-muted-foreground">/ {dailyCalorieGoal}</p>
			</div>
		</button>
	{:else}
		<div class="py-8 text-center text-sm text-muted-foreground">
			{m.calendar_no_meals()}
		</div>
	{/each}
</div>
