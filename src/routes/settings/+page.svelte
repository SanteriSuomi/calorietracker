<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
						import { invalidateAll } from '$app/navigation';
						import { page } from '$app/state';
						import { authClient } from '$lib/auth-client';
						import { Button } from '$lib/components/ui/button';
						import { Input } from '$lib/components/ui/input';
						import { Label } from '$lib/components/ui/label';
						import { Separator } from '$lib/components/ui/separator';
						import { Textarea } from '$lib/components/ui/textarea';
						import { m } from '$lib/paraglide/messages';
						import { locales, localizeHref } from '$lib/paraglide/runtime';
						import type { PageData } from './$types';

					let { data }: { data: PageData } = $props();

					let dailyCalorieGoal = $state('');
					let proteinGoal = $state('');
					let carbsGoal = $state('');
					let fatGoal = $state('');
					let aiEndpointUrl = $state('');
					let aiApiKey = $state('');
					let aiModel = $state('');
					let aiSystemPrompt = $state('');
					let age = $state('');
					let weight = $state('');
					let height = $state('');
					let activityLevel = $state('');
					let goal = $state('');

					$effect(() => {
						const d = data;
						dailyCalorieGoal = d.dailyCalorieGoal.toString();
						proteinGoal = d.dailyProteinGoal.toString();
						carbsGoal = d.dailyCarbsGoal.toString();
						fatGoal = d.dailyFatGoal.toString();
						aiEndpointUrl = d.aiEndpointUrl;
						aiApiKey = d.aiApiKey;
						aiModel = d.aiModel;
						aiSystemPrompt = d.aiSystemPrompt;
						age = d.age;
						weight = d.weight;
						height = d.height;
						activityLevel = d.activityLevel;
						goal = d.goal;
					});
						let saving = $state(false);
						let errors = $state<Record<string, string>>({});
						let success = $state(false);
						let estimating = $state(false);
						let estimateError = $state('');
						let testingAi = $state(false);
						let testResult = $state<{ success: boolean; latency_ms?: number; error?: string } | null>(null);
						let showDeleteDialog = $state(false);
						let deleting = $state(false);
						let deleteError = $state('');

						function validateNonNegInt(val: string): boolean {
							if (val === '') return true;
							const n = Number.parseInt(val, 10);
							return Number.isInteger(n) && n >= 0;
						}

						function validate(): Record<string, string> {
							const errs: Record<string, string> = {};
							const calGoal = Number.parseInt(dailyCalorieGoal, 10);
							if (dailyCalorieGoal === '' || !Number.isInteger(calGoal) || calGoal < 0) {
								errs.dailyCalorieGoal = 'Must be a non-negative integer';
							}
							if (!validateNonNegInt(proteinGoal)) {
								errs.proteinGoal = 'Must be a non-negative integer';
							}
							if (!validateNonNegInt(carbsGoal)) {
								errs.carbsGoal = 'Must be a non-negative integer';
							}
							if (!validateNonNegInt(fatGoal)) {
								errs.fatGoal = 'Must be a non-negative integer';
							}
							if (aiEndpointUrl && !/^https?:\/\/.+/.test(aiEndpointUrl)) {
								errs.aiEndpointUrl = 'Must be a valid URL (http:// or https://)';
							}
							if (aiSystemPrompt && aiSystemPrompt.length > 2000) {
								errs.aiSystemPrompt = 'Must be at most 2000 characters';
							}
							if (age !== '') {
								const n = Number.parseInt(age, 10);
								if (!Number.isInteger(n) || n < 10 || n > 120) {
									errs.age = 'Must be 10-120';
								}
							}
							if (weight !== '') {
								const n = Number.parseInt(weight, 10);
								if (!Number.isInteger(n) || n < 20 || n > 500) {
									errs.weight = 'Must be 20-500';
								}
							}
							if (height !== '') {
								const n = Number.parseInt(height, 10);
								if (!Number.isInteger(n) || n < 50 || n > 300) {
									errs.height = 'Must be 50-300';
								}
							}
							return errs;
						}

						function parseOptionalInt(val: string): number | null {
							if (val === '') return null;
							const n = Number.parseInt(val, 10);
							return Number.isInteger(n) && n >= 0 ? n : null;
						}

						async function handleTestAi() {
							testResult = null;
							if (!aiEndpointUrl?.trim() || !aiApiKey?.trim() || !aiModel?.trim()) {
								testResult = { success: false, error: 'Endpoint URL, API Key, and Model are required.' };
								return;
							}

							testingAi = true;
							try {
								const res = await fetch('/api/ai/test', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										aiEndpointUrl: aiEndpointUrl.trim(),
										aiApiKey: aiApiKey.trim(),
										aiModel: aiModel.trim()
									})
								});
								testResult = await res.json();
							} catch {
								testResult = { success: false, error: 'Network error' };
							} finally {
								testingAi = false;
							}
						}

						async function handleSave() {
							errors = {};
							success = false;
							testResult = null;
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
										dailyProteinGoal: parseOptionalInt(proteinGoal),
										dailyCarbsGoal: parseOptionalInt(carbsGoal),
										dailyFatGoal: parseOptionalInt(fatGoal),
										aiEndpointUrl: aiEndpointUrl || null,
										aiApiKey: aiApiKey || null,
										aiModel: aiModel || null,
										aiSystemPrompt: aiSystemPrompt || null,
										age: parseOptionalInt(age),
										weight: parseOptionalInt(weight),
										height: parseOptionalInt(height),
										activityLevel: activityLevel || null,
										goal: goal || null
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

						async function handleEstimate() {
							estimateError = '';
							if (!age || !weight || !height || !activityLevel || !goal) {
								estimateError = m.settings_estimate_hint();
								return;
							}

							const ageNum = Number.parseInt(age, 10);
							const weightNum = Number.parseInt(weight, 10);
							const heightNum = Number.parseInt(height, 10);
							if (
								!Number.isInteger(ageNum) || ageNum < 10 || ageNum > 120 ||
								!Number.isInteger(weightNum) || weightNum < 20 || weightNum > 500 ||
								!Number.isInteger(heightNum) || heightNum < 50 || heightNum > 300
							) {
								estimateError = m.settings_estimate_hint();
								return;
							}

							if (!aiEndpointUrl || !aiApiKey || !aiModel) {
								estimateError = m.settings_estimate_not_configured();
								return;
							}

							estimating = true;
							try {
								const res = await fetch('/api/ai/estimate-goals', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										age: ageNum,
										weight: weightNum,
										height: heightNum,
										activityLevel,
										goal
									})
								});

								if (!res.ok) {
									const err = await res.json();
									estimateError = err.error || m.settings_estimate_failed();
									return;
								}

								const result = await res.json();
								dailyCalorieGoal = result.calories.toString();
								proteinGoal = result.protein.toString();
								carbsGoal = result.carbs.toString();
								fatGoal = result.fat.toString();
							} catch {
								estimateError = m.settings_estimate_failed();
							} finally {
								estimating = false;
							}
						}

						async function handleDeleteAccount() {
							deleting = true;
							deleteError = '';
							try {
								const res = await fetch('/api/account/delete', { method: 'POST' });
								if (!res.ok) {
									const err = await res.json();
									deleteError = err.error || m.error_delete_account();
									deleting = false;
									return;
								}
								await authClient.signOut();
								window.location.href = localizeHref('/auth');
							} catch {
								deleteError = m.error_delete_account();
								deleting = false;
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
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_ai_config()}</h2>
		<div class="flex flex-col gap-2">
			<Label for="aiEndpointUrl">{m.settings_endpoint_url()}</Label>
			<Input
				id="aiEndpointUrl"
				type="text"
				bind:value={aiEndpointUrl}
				placeholder={m.settings_endpoint_placeholder()}
			/>
			{#if data.aiDefaultEndpoint}
				<span class="text-xs text-muted-foreground">Using default endpoint</span>
			{/if}
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
			{#if data.aiDefaultModel}
				<span class="text-xs text-muted-foreground">Using default model</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={handleTestAi} disabled={testingAi}>
				{testingAi ? m.settings_testing() : m.settings_test_connection()}
			</Button>
			{#if testResult}
				{#if testResult.success}
					<span class="text-xs text-green-600">{m.settings_test_success({ latency: testResult.latency_ms ?? 0 })}</span>
				{:else}
					<span class="text-xs text-destructive">{testResult.error}</span>
				{/if}
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="aiSystemPrompt">{m.settings_ai_system_prompt()}</Label>
			<Textarea
				id="aiSystemPrompt"
				bind:value={aiSystemPrompt}
				placeholder="You are an expert nutrition estimation assistant..."
				rows={4}
			/>
			{#if errors.aiSystemPrompt}
				<span class="text-xs text-destructive">{errors.aiSystemPrompt}</span>
			{/if}
			<p class="text-xs text-muted-foreground">{m.settings_ai_system_prompt_desc()}</p>
		</div>
	</section>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_profile()}</h2>
		<div class="flex flex-col gap-2">
			<Label for="age">{m.settings_age()}</Label>
			<Input
				id="age"
				type="number"
				bind:value={age}
				min="10"
				max="120"
				placeholder={m.settings_age_placeholder()}
			/>
			{#if errors.age}
				<span class="text-xs text-destructive">{errors.age}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="weight">{m.settings_weight()}</Label>
			<Input
				id="weight"
				type="number"
				bind:value={weight}
				min="20"
				max="500"
				placeholder={m.settings_weight_placeholder()}
			/>
			{#if errors.weight}
				<span class="text-xs text-destructive">{errors.weight}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="height">{m.settings_height()}</Label>
			<Input
				id="height"
				type="number"
				bind:value={height}
				min="50"
				max="300"
				placeholder={m.settings_height_placeholder()}
			/>
			{#if errors.height}
				<span class="text-xs text-destructive">{errors.height}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="activityLevel">{m.settings_activity_level()}</Label>
			<select
				id="activityLevel"
				bind:value={activityLevel}
				class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<option value="">{''}</option>
				<option value="sedentary">{m.settings_activity_sedentary()}</option>
				<option value="light">{m.settings_activity_light()}</option>
				<option value="moderate">{m.settings_activity_moderate()}</option>
				<option value="active">{m.settings_activity_active()}</option>
				<option value="very_active">{m.settings_activity_very_active()}</option>
			</select>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="goal">{m.settings_goal()}</Label>
			<select
				id="goal"
				bind:value={goal}
				class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<option value="">{''}</option>
				<option value="lose">{m.settings_goal_lose()}</option>
				<option value="maintain">{m.settings_goal_maintain()}</option>
				<option value="gain">{m.settings_goal_gain()}</option>
			</select>
		</div>
	</section>

	<Separator />

	<section class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">{m.settings_goals()}</h2>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={handleEstimate}
				disabled={estimating}
			>
				{estimating ? m.settings_estimating() : m.settings_estimate_goals()}
			</Button>
		</div>
		{#if estimateError}
			<span class="text-xs text-destructive">{estimateError}</span>
		{/if}
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
		<div class="flex flex-col gap-2">
			<Label for="proteinGoal">{m.settings_daily_protein_goal()}</Label>
			<Input
				id="proteinGoal"
				type="number"
				bind:value={proteinGoal}
				min="0"
				placeholder={m.settings_protein_placeholder()}
			/>
			{#if errors.proteinGoal}
				<span class="text-xs text-destructive">{errors.proteinGoal}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="carbsGoal">{m.settings_daily_carbs_goal()}</Label>
			<Input
				id="carbsGoal"
				type="number"
				bind:value={carbsGoal}
				min="0"
				placeholder={m.settings_carbs_placeholder()}
			/>
			{#if errors.carbsGoal}
				<span class="text-xs text-destructive">{errors.carbsGoal}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<Label for="fatGoal">{m.settings_daily_fat_goal()}</Label>
			<Input
				id="fatGoal"
				type="number"
				bind:value={fatGoal}
				min="0"
				placeholder={m.settings_fat_placeholder()}
			/>
			{#if errors.fatGoal}
				<span class="text-xs text-destructive">{errors.fatGoal}</span>
			{/if}
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
		<div class="pt-4">
			<h3 class="text-sm font-medium text-destructive">{m.settings_delete_account()}</h3>
			<p class="text-xs text-muted-foreground mt-1">{m.settings_delete_account_desc()}</p>
			<Button
				variant="destructive"
				size="sm"
				class="mt-2"
				onclick={() => (showDeleteDialog = true)}
			>
				{m.settings_delete_account()}
			</Button>
		</div>
	</section>
</div>

{#if showDeleteDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div class="fixed inset-0 bg-black/50" onclick={() => (showDeleteDialog = false)} role="presentation"></div>
		<div class="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg mx-4">
			<h3 class="text-lg font-semibold">{m.settings_delete_account_title()}</h3>
			<p class="mt-2 text-sm text-muted-foreground">{m.settings_delete_account_warning()}</p>
			{#if deleteError}
				<p class="mt-2 text-sm text-destructive">{deleteError}</p>
			{/if}
			<div class="mt-4 flex justify-end gap-2">
				<Button
					variant="outline"
					onclick={() => {
						showDeleteDialog = false;
						deleteError = '';
					}}
					disabled={deleting}
				>
					{m.settings_delete_account_cancel()}
				</Button>
				<Button
					variant="destructive"
					onclick={handleDeleteAccount}
					disabled={deleting}
				>
					{deleting ? m.settings_deleting() : m.settings_delete_account_confirm()}
				</Button>
			</div>
		</div>
	</div>
{/if}
