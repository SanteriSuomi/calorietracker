<script lang="ts">
	import { X } from '@lucide/svelte';
	import { Dialog, Portal } from 'bits-ui';
	import { cn, type WithElementRef } from '$lib/utils';

	let {
		side = 'right',
		class: className,
		...restProps
	}: WithElementRef<Dialog.ContentProps> & { side?: 'top' | 'bottom' | 'left' | 'right' } = $props();

	const sideClasses: Record<string, string> = {
		top: 'inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
		bottom: 'inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
		left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
		right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right'
	};
</script>

<Portal>
	<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
	<Dialog.Content
		{...restProps}
		class={cn(
			'fixed z-50 flex flex-col bg-background p-6 shadow-lg ring-1 ring-foreground/10 animate-in',
			side === 'bottom' ? 'max-h-[85vh]' : '',
			sideClasses[side],
			className
		)}
	>
		<div data-slot="sheet-content-wrapper">
			<div data-slot="sheet-header" class="flex flex-col gap-0.5 text-left sm:text-sm mb-4">
				<Dialog.Title data-slot="sheet-title" />
				<Dialog.Description data-slot="sheet-description" />
			</div>
			<div data-slot="sheet-body" class="flex-1 overflow-y-auto">
				{@render restProps.children?.()}
			</div>
		</div>
		<Dialog.Close
			class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
		>
			<X class="w-4 h-4" />
			<span class="sr-only">Close</span>
		</Dialog.Close>
	</Dialog.Content>
</Portal>
