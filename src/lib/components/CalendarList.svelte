<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { localizeHref } from '$lib/paraglide/runtime';
	import type { DaySummary } from '$lib/types';
	import { formatDate } from '$lib/utils/date';

	let { days }: { days: DaySummary[] } = $props();
</script>

<div class="divide-y divide-border">
	{#each days as day (day.date)}
		<button
			type="button"
			class="flex w-full items-center justify-between px-4 py-3 text-left
				hover:bg-muted/50 transition-colors"
			onclick={() => goto(localizeHref('/') + `?date=${day.date}`)}
		>
			<div class="flex-1">
				<p class="text-sm font-medium">{formatDate(day.date)}</p>
				<p class="text-xs text-muted-foreground">
					{m.calendar_macro_summary({ protein: day.protein, carbs: day.carbs, fat: day.fat })}
				</p>
			</div>
		</button>
	{:else}
		<div class="py-8 text-center text-sm text-muted-foreground">
			{m.calendar_no_meals()}
		</div>
	{/each}
</div>
