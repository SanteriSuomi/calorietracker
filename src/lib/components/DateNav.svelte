<script lang="ts">
	import { goto } from '$app/navigation';
				import { Button } from '$lib/components/ui/button';
				import { addDays, formatDate, today } from '$lib/utils/date';
	
		
				let { date }: { date: string } = $props();
		
				function prevDay() {
					goto(`?date=${addDays(date, -1)}`);
				}
		
				function nextDay() {
					const next = addDays(date, 1);
					if (next <= today()) {
						goto(`?date=${next}`);
					}
				}
</script>

<div class="flex items-center justify-between py-2">
	<Button variant="ghost" size="icon" onclick={prevDay} aria-label="Previous day">
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
	</Button>
	<span class="font-medium text-sm">{formatDate(date)}</span>
	<Button variant="ghost" size="icon" onclick={nextDay} disabled={date >= today()} aria-label="Next day">
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
	</Button>
</div>
