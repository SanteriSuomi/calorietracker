<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
			import { invalidateAll } from '$app/navigation';
			import { authClient } from '$lib/auth-client';
			import { Button } from '$lib/components/ui/button';
			import { Input } from '$lib/components/ui/input';
			import { Label } from '$lib/components/ui/label';
			import { Separator } from '$lib/components/ui/separator';
			import type { PageData } from './$types';
	
		
			let { data }: { data: PageData } = $props();
		
			let dailyCalorieGoal = $state(data.dailyCalorieGoal.toString());
			let aiEndpointUrl = $state(data.aiEndpointUrl);
			let aiApiKey = $state(data.aiApiKey);
			let aiModel = $state(data.aiModel);
			let saving = $state(false);
			let errors = $state<Record<string, string>>({});
			let success = $state(false);
		
			function validate(): Record<string, string> {
				const errs: Record<string, string> = {};
				const goal = Number.parseInt(dailyCalorieGoal, 10);
				if (dailyCalorieGoal === '' || !Number.isInteger(goal) || goal < 0) {
					errs.dailyCalorieGoal = 'Must be a non-negative integer';
				}
				if (aiEndpointUrl && !/^https?:\/\/.+/.test(aiEndpointUrl)) {
					errs.aiEndpointUrl = 'Must be a valid URL (http:// or https://)';
				}
				return errs;
			}
		
			async function handleSave() {
				errors = {};
				success = false;
				const errs = validate();
				if (Object.keys(errs).length > 0) {
					errors = errs;
					return;
				}
		
				saving = true;
				try {
					const res = await fetch('/api/settings', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							dailyCalorieGoal: Number.parseInt(dailyCalorieGoal, 10),
							aiEndpointUrl: aiEndpointUrl || null,
							aiApiKey: aiApiKey || null,
							aiModel: aiModel || null
						})
					});
		
					if (!res.ok) {
						const err = await res.json();
						errors.form = err.error || 'Failed to save settings';
						return;
					}
		
					success = true;
					await invalidateAll();
				} catch {
					errors.form = 'Network error';
				} finally {
					saving = false;
				}
			}
		
			async function handleSignOut() {
				await authClient.signOut();
				window.location.href = '/';
			}
</script>

<svelte:head>
	<title>Settings — CalorieTracker</title>
</svelte:head>

<div class="flex items-center gap-3 mb-6">
	<a href="/" class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
		<ArrowLeft size={20} />
	</a>
	<h1 class="text-lg font-semibold">Settings</h1>
</div>

<div class="flex flex-col gap-6">
	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Goals</h2>
		<div class="flex flex-col gap-2">
			<Label for="dailyCalorieGoal">Daily Calorie Goal</Label>
			<Input
				id="dailyCalorieGoal"
				type="number"
				bind:value={dailyCalorieGoal}
				min="0"
				placeholder="2000"
			/>
			{#if errors.dailyCalorieGoal}
				<span class="text-xs text-destructive">{errors.dailyCalorieGoal}</span>
			{/if}
		</div>
	</section>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">AI Configuration</h2>
		<div class="flex flex-col gap-2">
			<Label for="aiEndpointUrl">Endpoint URL</Label>
			<Input
				id="aiEndpointUrl"
				type="text"
				bind:value={aiEndpointUrl}
				placeholder="https://api.openai.com/v1"
			/>
			{#if errors.aiEndpointUrl}
				<span class="text-xs text-destructive">{errors.aiEndpointUrl}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="aiApiKey">API Key</Label>
			<Input
				id="aiApiKey"
				type="password"
				bind:value={aiApiKey}
				placeholder="sk-..."
			/>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="aiModel">Model</Label>
			<Input
				id="aiModel"
				type="text"
				bind:value={aiModel}
				placeholder="gpt-4o"
			/>
		</div>
	</section>

	{#if errors.form}
		<span class="text-sm text-destructive">{errors.form}</span>
	{/if}

	{#if success}
		<span class="text-sm text-green-600">Saved</span>
	{/if}

	<Button onclick={handleSave} disabled={saving}>
		{saving ? 'Saving...' : 'Save Settings'}
	</Button>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Account</h2>
		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">{data.email}</span>
		</div>
		<Button variant="outline" onclick={handleSignOut}>Sign out</Button>
	</section>
</div>
