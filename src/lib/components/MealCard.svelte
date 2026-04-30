<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
			import { Badge } from '$lib/components/ui/badge';
			import * as Card from '$lib/components/ui/card';
	
		
			let {
				description,
				calories,
				protein,
				carbs,
				fat,
				imageFilename,
				onEdit,
				onDelete
			}: {
				description: string;
				calories: number;
				protein: number;
				carbs: number;
				fat: number;
				imageFilename?: string | null;
				onEdit?: () => void;
				onDelete?: () => void;
			} = $props();
		
			function handleDelete() {
				if (onDelete && confirm('Delete this meal?')) onDelete();
			}
</script>

<Card.Content class="py-3 px-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center min-w-0 flex-1">
			{#if imageFilename}
				<img
					src={`/api/images/${imageFilename}`}
					alt={description}
					class="w-12 h-12 rounded-md object-cover flex-shrink-0 mr-3"
					loading="lazy"
				/>
			{/if}
			<span class="font-medium text-sm truncate mr-2">{description}</span>
		</div>
		<div class="flex items-center gap-1 flex-shrink-0">
			<span class="font-semibold text-sm whitespace-nowrap">{calories}</span>
			{#if onEdit}
				<button onclick={onEdit} class="ml-1 p-1 rounded-sm opacity-50 hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" aria-label="Edit meal">
					<Pencil size={14} />
				</button>
			{/if}
			{#if onDelete}
				<button onclick={handleDelete} class="p-1 rounded-sm opacity-50 hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" aria-label="Delete meal">
					<Trash2 size={14} />
				</button>
			{/if}
		</div>
	</div>
	<div class="flex gap-2 mt-1.5">
		<Badge variant="secondary" class="text-xs">P: {protein}g</Badge>
		<Badge variant="secondary" class="text-xs">C: {carbs}g</Badge>
		<Badge variant="secondary" class="text-xs">F: {fat}g</Badge>
	</div>
</Card.Content>
