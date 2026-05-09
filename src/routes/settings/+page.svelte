<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
		import { invalidateAll } from '$app/navigation';
		import { page } from '$app/state';
		import { authClient } from '$lib/auth-client';
		import { Button } from '$lib/components/ui/button';
		import { Input } from '$lib/components/ui/input';
		import { Label } from '$lib/components/ui/label';
		import { Separator } from '$lib/components/ui/separator';
		import { m } from '$lib/paraglide/messages';
		import { locales, localizeHref } from '$lib/paraglide/runtime';
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
					errors.form = err.error || m.error_save_settings();
					return;
				}

				success = true;
				await invalidateAll();
			} catch {
				errors.form = m.error_network();
			} finally {
				saving = false;
			}
		}

		async function handleSignOut() {
			await authClient.signOut();
			window.location.href = localizeHref('/');
		}
</script>

<svelte:head>
	<title>{m.settings_title()}</title>
</svelte:head>

<div class="flex items-center gap-3 mb-6">
	<a href={localizeHref('/')} class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
		<ArrowLeft size={20} />
	</a>
	<h1 class="text-lg font-semibold">{m.settings_heading()}</h1>
</div>

<div class="flex flex-col gap-6">
	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_goals()}</h2>
		<div class="flex flex-col gap-2">
			<Label for="dailyCalorieGoal">{m.settings_daily_calorie_goal()}</Label>
			<Input
				id="dailyCalorieGoal"
				type="number"
				bind:value={dailyCalorieGoal}
				min="0"
				placeholder={m.settings_calorie_placeholder()}
			/>
			{#if errors.dailyCalorieGoal}
				<span class="text-xs text-destructive">{errors.dailyCalorieGoal}</span>
			{/if}
		</div>
	</section>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_ai_config()}</h2>
		<div class="flex flex-col gap-2">
			<Label for="aiEndpointUrl">{m.settings_endpoint_url()}</Label>
			<Input
				id="aiEndpointUrl"
				type="text"
				bind:value={aiEndpointUrl}
				placeholder={m.settings_endpoint_placeholder()}
			/>
			{#if errors.aiEndpointUrl}
				<span class="text-xs text-destructive">{errors.aiEndpointUrl}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="aiApiKey">{m.settings_api_key()}</Label>
			<Input
				id="aiApiKey"
				type="password"
				bind:value={aiApiKey}
				placeholder={m.settings_api_key_placeholder()}
			/>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="aiModel">{m.settings_model()}</Label>
			<Input
				id="aiModel"
				type="text"
				bind:value={aiModel}
				placeholder={m.settings_model_placeholder()}
			/>
		</div>
	</section>

	{#if errors.form}
		<span class="text-sm text-destructive">{errors.form}</span>
	{/if}

	{#if success}
		<span class="text-sm text-green-600">{m.settings_saved()}</span>
	{/if}

	<Button onclick={handleSave} disabled={saving}>
		{saving ? m.settings_saving() : m.settings_save()}
	</Button>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_language()}</h2>
		<div class="flex gap-2">
			{#each locales as locale}
				<a
					href={localizeHref(page.url.pathname, { locale })}
					data-sveltekit-reload
					class="rounded-md border px-3 py-1.5 text-sm"
				>
					{locale === 'en' ? m.settings_language_en() : m.settings_language_fi()}
				</a>
			{/each}
		</div>
	</section>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_account()}</h2>
		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">{data.email}</span>
		</div>
		<Button variant="outline" onclick={handleSignOut}>{m.settings_sign_out()}</Button>
	</section>
</div>
