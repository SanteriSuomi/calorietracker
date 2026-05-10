<script lang="ts">
	import './layout.css';
			
					import { CalendarDays, Settings } from '@lucide/svelte';
					import { navigating } from '$app/state';
					import favicon from '$lib/assets/favicon.svg';
					import { authClient } from '$lib/auth-client';
					import { m } from '$lib/paraglide/messages';
					import { localizeHref } from '$lib/paraglide/runtime';
	
		
			
					let { children, data } = $props();
			
					async function handleSignOut() {
						await authClient.signOut();
						window.location.href = localizeHref('/');
					}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<div class="flex min-h-dvh flex-col bg-background">
		<header class="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
			{#if navigating.to}
				<div class="absolute top-full left-0 right-0 z-50 h-0.5 bg-primary/30">
					<div class="h-full bg-primary animate-pulse-progress"></div>
				</div>
			{/if}
			<div class="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
				<a href={localizeHref('/')} class="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors">{m.app_name()}</a>
				<div class="flex items-center gap-3">
					<a href={localizeHref('/calendar')} class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" aria-label={m.layout_nav_calendar()}>
						<CalendarDays size={18} />
					</a>
					<a href={localizeHref('/settings')} class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" aria-label={m.layout_nav_settings()}>
						<Settings size={18} />
					</a>
					<span class="text-sm text-muted-foreground">{data.user.email}</span>
					<button
						type="button"
						onclick={handleSignOut}
						class="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						{m.layout_sign_out()}
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
