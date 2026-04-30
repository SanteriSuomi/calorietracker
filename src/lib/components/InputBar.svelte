<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Camera, Pencil, Sparkles, Loader2 } from '@lucide/svelte';
	import type { MealFormData } from '$lib/types';

	let {
		date,
		aiConfigured,
		onAiResult,
		onManualEntry
	}: {
		date: string;
		aiConfigured: boolean;
		onAiResult: (data: MealFormData) => void;
		onManualEntry: () => void;
	} = $props();

	let description = $state('');
	let loading = $state(false);
	let error = $state('');

	let errorTimeout: ReturnType<typeof setTimeout> | null = null;

	function clearError() {
		error = '';
		if (errorTimeout) {
			clearTimeout(errorTimeout);
			errorTimeout = null;
		}
	}

	function showError(msg: string) {
		clearError();
		error = msg;
		errorTimeout = setTimeout(() => {
			error = '';
			errorTimeout = null;
		}, 5000);
	}

	async function handleAiSubmit() {
		if (!description.trim()) return;
		if (!aiConfigured) {
			showError('Configure AI in Settings first');
			return;
		}

		clearError();
		loading = true;
		try {
			const res = await fetch('/api/ai/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: description.trim() })
			});

			if (!res.ok) {
				const err = await res.json();
				showError(err.error || 'AI analysis failed');
				return;
			}

			const result = await res.json();
			onAiResult({
				description: result.description,
				calories: result.calories,
				protein: result.protein,
				carbs: result.carbs,
				fat: result.fat,
				date
			});
			description = '';
		} catch {
			showError('Network error');
		} finally {
			loading = false;
		}
	}
</script>

<div class="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
	<div class="mx-auto max-w-2xl px-4 py-3">
		<div class="flex flex-col gap-2">
			<Input
				type="text"
				bind:value={description}
				placeholder="Describe your meal..."
				disabled={loading}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						handleAiSubmit();
					}
				}}
			/>
			{#if error}
				<span class="text-xs text-destructive">{error}</span>
			{/if}
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					disabled
					title="Coming soon"
					class="text-muted-foreground"
				>
					<Camera size={18} />
				</Button>
				<div class="flex-1"></div>
				<Button
					variant="default"
					size="sm"
					onclick={handleAiSubmit}
					disabled={loading || !description.trim()}
				>
					{#if loading}
						<Loader2 size={16} class="animate-spin" />
					{:else}
						<Sparkles size={16} />
					{/if}
					AI
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={onManualEntry}
					disabled={loading}
				>
					<Pencil size={16} />
					Manual
				</Button>
			</div>
		</div>
	</div>
</div>
