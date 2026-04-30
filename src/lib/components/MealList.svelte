<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import type { Meal } from '$lib/types';
	import MealCard from './MealCard.svelte';

	let {
		meals,
		onEdit,
		onDelete
	}: {
		meals: Meal[];
		onEdit?: (meal: Meal) => void;
		onDelete?: (meal: Meal) => void;
	} = $props();
</script>

<div class="flex-1 overflow-y-auto">
	<h2 class="text-sm font-semibold text-muted-foreground mb-3">Meals</h2>

	{#if meals.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
			<span class="text-3xl mb-2">&#127858;</span>
			<p class="text-sm">No meals logged yet</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each meals as meal (meal.id)}
				<Card.Root>
				<MealCard
					description={meal.description}
					calories={meal.calories}
					protein={meal.protein}
					carbs={meal.carbs}
					fat={meal.fat}
					onEdit={onEdit ? () => onEdit(meal) : undefined}
					onDelete={onDelete ? () => onDelete(meal) : undefined}
				/>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
