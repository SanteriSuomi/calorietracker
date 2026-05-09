<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import type { DaySummary } from '$lib/types';
	import {
		addMonths,
		formatMonthYear,
		getDaysInMonth,
		getFirstDayOfWeek,
		toDateString,
		today
	} from '$lib/utils/date';

	let {
		currentMonth,
		daySummaries,
		onPrevMonth,
		onNextMonth
	}: {
		currentMonth: string;
		daySummaries: Record<string, DaySummary>;
		onPrevMonth: () => void;
		onNextMonth: () => void;
	} = $props();

	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	const todayStr = $derived(today());
	const isFutureMonth = $derived(currentMonth >= todayStr.slice(0, 7));

	const calendarDays = $derived.by(() => {
		const [year, month] = currentMonth.split('-').map(Number);
		const daysInMonth = getDaysInMonth(year, month);
		const firstDay = getFirstDayOfWeek(year, month);

		const prevMonth = month === 1 ? 12 : month - 1;
		const prevYear = month === 1 ? year - 1 : year;
		const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

		const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

		for (let i = firstDay - 1; i >= 0; i--) {
			const day = daysInPrevMonth - i;
			days.push({ date: toDateString(prevYear, prevMonth, day), day, isCurrentMonth: false });
		}

		for (let d = 1; d <= daysInMonth; d++) {
			days.push({ date: toDateString(year, month, d), day: d, isCurrentMonth: true });
		}

		const remainder = days.length % 7;
		if (remainder > 0) {
			const nextMonth = month === 12 ? 1 : month + 1;
			const nextYear = month === 12 ? year + 1 : year;
			for (let d = 1; d <= 7 - remainder; d++) {
				days.push({ date: toDateString(nextYear, nextMonth, d), day: d, isCurrentMonth: false });
			}
		}

		return days;
	});
</script>

<div>
	<div class="flex items-center justify-between py-2 mb-2">
		<Button variant="ghost" size="icon" onclick={onPrevMonth}>&#9664;</Button>
		<span class="font-medium text-sm">{formatMonthYear(currentMonth)}</span>
		<Button variant="ghost" size="icon" onclick={onNextMonth} disabled={isFutureMonth}>&#9654;</Button>
	</div>

	<div class="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
		{#each WEEKDAYS as day}
			<div class="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">
				{day}
			</div>
		{/each}

		{#each calendarDays as cell}
			<button
				type="button"
				class="bg-background p-2 min-h-[64px] text-left relative
					{!cell.isCurrentMonth ? 'opacity-40' : ''}
					{cell.date === todayStr ? 'ring-2 ring-primary rounded-sm' : ''}"
				onclick={() => goto(`/?date=${cell.date}`)}
				disabled={cell.date > todayStr}
			>
				<span class="text-xs font-medium">{cell.day}</span>
				{#if daySummaries[cell.date]}
					<span class="block text-xs text-muted-foreground mt-1">
						{daySummaries[cell.date].calories}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
