<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	
				let { protein, carbs, fat }: { protein: number; carbs: number; fat: number } = $props();
</script>

<div class="flex justify-around py-2">
	<Badge variant="secondary">P: {protein}g</Badge>
	<Badge variant="secondary">C: {carbs}g</Badge>
	<Badge variant="secondary">F: {fat}g</Badge>
</div>
