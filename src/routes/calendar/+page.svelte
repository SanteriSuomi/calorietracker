<script lang="ts">
	import { goto } from '$app/navigation';
	import CalendarGrid from '$lib/components/CalendarGrid.svelte';
	import CalendarList from '$lib/components/CalendarList.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { m } from '$lib/paraglide/messages';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { addMonths, today } from '$lib/utils/date';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let activeTab = $state('grid');
	let currentMonth = $state('');

	$effect(() => {
		currentMonth = data.currentMonth;
	});

	const todayMonth = $derived(today().slice(0, 7));

	function handlePrevMonth() {
		currentMonth = addMonths(`${currentMonth}-01`, -1).slice(0, 7);
		goto(`?month=${currentMonth}`);
	}

	function handleNextMonth() {
		const next = addMonths(`${currentMonth}-01`, 1).slice(0, 7);
		if (next > todayMonth) return;
		currentMonth = next;
		goto(`?month=${currentMonth}`);
	}
</script>

<svelte:head>
	<title>{m.calendar_title()}</title>
</svelte:head>

<div class="mb-4">
	<a href={localizeHref('/')} class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
		{m.calendar_back_to_today()}
	</a>
</div>
<Tabs.Root bind:value={activeTab}>
	<Tabs.List class="mb-4">
		<Tabs.Trigger value="grid">{m.calendar_tab_grid()}</Tabs.Trigger>
		<Tabs.Trigger value="list">{m.calendar_tab_list()}</Tabs.Trigger>
	</Tabs.List>

	<Tabs.Content value="grid">
		<CalendarGrid
			{currentMonth}
			daySummaries={data.gridData}
			onPrevMonth={handlePrevMonth}
			onNextMonth={handleNextMonth}
		/>
	</Tabs.Content>

	<Tabs.Content value="list">
		<CalendarList days={data.listData} dailyCalorieGoal={data.dailyCalorieGoal} />
	</Tabs.Content>
</Tabs.Root>
