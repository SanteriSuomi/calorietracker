<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn, type WithElementRef } from '$lib/utils';

	let { class: className, ...restProps }: WithElementRef<Dialog.TitleProps> = $props();
</script>

<Dialog.Title
	{...restProps}
	class={cn('text-lg font-semibold leading-none tracking-tight', className)}
/>
