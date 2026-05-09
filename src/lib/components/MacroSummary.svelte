<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
		import { m } from '$lib/paraglide/messages';

		let {
			protein,
			carbs,
			fat,
			proteinGoal = null,
			carbsGoal = null,
			fatGoal = null
		}: {
			protein: number;
			carbs: number;
			fat: number;
			proteinGoal?: number | null;
			carbsGoal?: number | null;
			fatGoal?: number | null;
		} = $props();
</script>

<div class="flex justify-around py-2">
	<Badge variant="secondary">
		{#if proteinGoal}
			{m.meal_protein_badge({ count: protein })}/{proteinGoal}g
		{:else}
			{m.meal_protein_badge({ count: protein })}
		{/if}
	</Badge>
	<Badge variant="secondary">
		{#if carbsGoal}
			{m.meal_carbs_badge({ count: carbs })}/{carbsGoal}g
		{:else}
			{m.meal_carbs_badge({ count: carbs })}
		{/if}
	</Badge>
	<Badge variant="secondary">
		{#if fatGoal}
			{m.meal_fat_badge({ count: fat })}/{fatGoal}g
		{:else}
			{m.meal_fat_badge({ count: fat })}
		{/if}
	</Badge>
</div>
