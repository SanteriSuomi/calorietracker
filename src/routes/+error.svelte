<script lang="ts">
	import { page } from '$app/state';
											import { Button } from '$lib/components/ui/button';
											import { localizeHref } from '$lib/paraglide/runtime';
</script>

<svelte:head>
	<title>{page.status} — CalorieTracker</title>
</svelte:head>

<div class="flex flex-col items-center justify-center py-20 text-center">
	<h1 class="text-4xl font-bold">{page.status}</h1>
	<p class="mt-2 text-muted-foreground">
		{page.status === 404 ? 'Page not found' : page.error?.message ?? 'Something went wrong'}
	</p>
	<a href={localizeHref('/')} class="mt-6">
		<Button>Go home</Button>
	</a>
</div>
