<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
		import * as Card from '$lib/components/ui/card';

		let {
			description,
			calories,
			protein,
			carbs,
			fat
		}: {
			description: string;
			calories: number;
			protein: number;
			carbs: number;
			fat: number;
		} = $props();
</script>

<Card.Content class="py-3 px-4">
	<div class="flex items-center justify-between">
		<span class="font-medium text-sm truncate mr-2">{description}</span>
		<span class="font-semibold text-sm whitespace-nowrap">{calories}</span>
	</div>
	<div class="flex gap-2 mt-1.5">
		<Badge variant="secondary" class="text-xs">P: {protein}g</Badge>
		<Badge variant="secondary" class="text-xs">C: {carbs}g</Badge>
		<Badge variant="secondary" class="text-xs">F: {fat}g</Badge>
	</div>
</Card.Content>
