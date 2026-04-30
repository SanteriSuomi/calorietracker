<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn, type WithElementRef } from '$lib/utils';

	let { class: className, ...restProps }: WithElementRef<Dialog.OverlayProps> = $props();
</script>

<Dialog.Overlay
	{...restProps}
	class={cn('fixed inset-0 z-40 bg-black/50', className)}
/>
