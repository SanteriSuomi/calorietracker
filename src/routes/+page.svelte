<script lang="ts">
	import CalorieDoughnut from '$lib/components/CalorieDoughnut.svelte';
	import DateNav from '$lib/components/DateNav.svelte';
	import InputBar from '$lib/components/InputBar.svelte';
	import MacroSummary from '$lib/components/MacroSummary.svelte';
	import ManualEntrySheet from '$lib/components/ManualEntrySheet.svelte';
	import MealList from '$lib/components/MealList.svelte';
	import { formatDate } from '$lib/utils/date';
	import { invalidateAll } from '$app/navigation';
	import type { Meal, MealFormData } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let sheetOpen = $state(false);
	let editingMeal = $state<Meal | null>(null);
	let aiPrefill = $state<MealFormData | null>(null);

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

	async function handleAddMeal(formData: MealFormData) {
		const res = await fetch('/api/meals', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});
		if (!res.ok) throw new Error('Failed to create meal');
		await invalidateAll();
	}

	async function handleEditMeal(formData: MealFormData) {
		if (!editingMeal) return;
		const res = await fetch(`/api/meals/${editingMeal.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});
		if (!res.ok) throw new Error('Failed to update meal');
		await invalidateAll();
	}

	async function handleDeleteMeal(meal: Meal) {
		const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Failed to delete meal');
		await invalidateAll();
	}

	function handleAiResult(formData: MealFormData) {
		aiPrefill = formData;
		editingMeal = null;
		sheetOpen = true;
	}

	function openManualEntry() {
		aiPrefill = null;
		editingMeal = null;
		sheetOpen = true;
	}

	function openEditSheet(meal: Meal) {
		aiPrefill = null;
		editingMeal = meal;
		sheetOpen = true;
	}

	function handleClose() {
		editingMeal = null;
	}

	$effect(() => {
		if (!sheetOpen) {
			aiPrefill = null;
		}
	});
</script>

<svelte:head>
	<title>{formattedDate} — CalorieTracker</title>
</svelte:head>

<DateNav date={data.date} />

<div class="flex justify-center py-4">
	<CalorieDoughnut eaten={totals.calories} goal={data.dailyCalorieGoal} />
</div>

<MacroSummary protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />

<MealList meals={data.meals} onEdit={openEditSheet} onDelete={handleDeleteMeal} />

<div class="h-28"></div>

<InputBar
	date={data.date}
	aiConfigured={data.aiConfigured}
	onAiResult={handleAiResult}
	onManualEntry={openManualEntry}
/>

<ManualEntrySheet
	bind:open={sheetOpen}
	meal={editingMeal}
	prefill={aiPrefill}
	date={data.date}
	onSubmit={editingMeal ? handleEditMeal : handleAddMeal}
	onClose={handleClose}
/>
