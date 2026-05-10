<script lang="ts">
	import { Dialog } from 'bits-ui';
	
		
			
				
					let {
						open = $bindable(),
						onOpenChange,
						children
					}: Dialog.RootProps & {
						open?: boolean;
						onOpenChange?: (isOpen: boolean) => void;
					} = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
	{@render children?.()}
</Dialog.Root>
