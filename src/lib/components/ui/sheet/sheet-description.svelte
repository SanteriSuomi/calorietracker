<script lang="ts">
	import { Dialog } from 'bits-ui';
						import { cn, type WithElementRef } from '$lib/utils';
	
		
			
				
					
						let { class: className, ...restProps }: WithElementRef<Dialog.DescriptionProps> = $props();
</script>

<Dialog.Description
	{...restProps}
	class={cn('text-sm text-muted-foreground', className)}
/>
