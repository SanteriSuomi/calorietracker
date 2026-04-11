<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';

	let { children, data } = $props();

	async function handleSignOut() {
		await authClient.signOut();
		window.location.href = '/';
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<div class="flex min-h-dvh flex-col bg-gray-50">
		<header class="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
			<div class="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
				<span class="text-sm font-semibold text-gray-900">CalorieTracker</span>
				<div class="flex items-center gap-3">
					<span class="text-sm text-gray-500">{data.user.email}</span>
					<button
						onclick={handleSignOut}
						class="rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
					>
						Sign out
					</button>
				</div>
			</div>
		</header>
		<main class="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
