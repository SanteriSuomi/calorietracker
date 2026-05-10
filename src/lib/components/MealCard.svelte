<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
			import { Badge } from '$lib/components/ui/badge';
			import * as Card from '$lib/components/ui/card';
			import { m } from '$lib/paraglide/messages';
	
		
			
				
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
				if (onDelete && confirm(m.meal_delete_confirm())) onDelete();
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
				<button onclick={onEdit} class="ml-1 p-1 rounded-sm opacity-50 hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" aria-label={m.meal_edit_aria()}>
					<Pencil size={14} />
				</button>
			{/if}
			{#if onDelete}
				<button onclick={handleDelete} class="p-1 rounded-sm opacity-50 hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" aria-label={m.meal_delete_aria()}>
					<Trash2 size={14} />
				</button>
			{/if}
		</div>
	</div>
	<div class="flex gap-2 mt-1.5">
		<Badge variant="secondary" class="text-xs">{m.meal_protein_badge({ count: protein })}</Badge>
		<Badge variant="secondary" class="text-xs">{m.meal_carbs_badge({ count: carbs })}</Badge>
		<Badge variant="secondary" class="text-xs">{m.meal_fat_badge({ count: fat })}</Badge>
	</div>
</Card.Content>
