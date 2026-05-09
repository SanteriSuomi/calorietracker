<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { m } from '$lib/paraglide/messages';

	let { protein, carbs, fat }: { protein: number; carbs: number; fat: number } = $props();
</script>

<div class="flex justify-around py-2">
	<Badge variant="secondary">{m.meal_protein_badge({ count: protein })}</Badge>
	<Badge variant="secondary">{m.meal_carbs_badge({ count: carbs })}</Badge>
	<Badge variant="secondary">{m.meal_fat_badge({ count: fat })}</Badge>
</div>
