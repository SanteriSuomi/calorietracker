<script lang="ts">
	import { goto } from '$app/navigation';
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
			onclick={() => goto(`/?date=${day.date}`)}
		>
			<div class="flex-1">
				<p class="text-sm font-medium">{formatDate(day.date)}</p>
				<p class="text-xs text-muted-foreground">
					P: {day.protein}g · C: {day.carbs}g · F: {day.fat}g
				</p>
			</div>
		</button>
	{:else}
		<div class="py-8 text-center text-sm text-muted-foreground">
			No meals logged yet
		</div>
	{/each}
</div>
