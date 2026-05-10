<script lang="ts">
	import { Camera, Loader2, Pencil, Sparkles, X } from '@lucide/svelte';
					import { Button } from '$lib/components/ui/button';
					import { Input } from '$lib/components/ui/input';
					import { m } from '$lib/paraglide/messages';
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
					let selectedImage = $state<File | null>(null);
					let previewUrl = $state<string | null>(null);
			
					let errorTimeout: ReturnType<typeof setTimeout> | null = null;
					let fileInput: HTMLInputElement | undefined = $state();
			
					$effect(() => {
						if (selectedImage) {
							if (previewUrl) URL.revokeObjectURL(previewUrl);
							previewUrl = URL.createObjectURL(selectedImage);
						} else if (previewUrl) {
							URL.revokeObjectURL(previewUrl);
							previewUrl = null;
						}
					});
			
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
			
					function handleFileSelect(e: Event) {
						const input = e.target as HTMLInputElement;
						if (input.files && input.files[0]) {
							selectedImage = input.files[0];
						}
					}
			
					function clearImage() {
						selectedImage = null;
						if (fileInput) fileInput.value = '';
					}
			
					async function handleAiSubmit() {
						const hasText = description.trim().length > 0;
						const hasImage = selectedImage !== null;
						if (!hasText && !hasImage) return;
						if (!aiConfigured) {
							showError(m.input_ai_not_configured());
							return;
						}
			
						clearError();
						loading = true;
						try {
							const formData = new FormData();
							if (hasText) formData.append('description', description.trim());
							if (selectedImage) formData.append('image', selectedImage);
			
							const res = await fetch('/api/ai/analyze', {
								method: 'POST',
								body: formData
							});
			
							if (!res.ok) {
								const err = await res.json();
								showError(err.error || m.input_ai_failed());
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
							clearImage();
						} catch {
							showError(m.input_network_error());
						} finally {
							loading = false;
						}
					}
</script>

<div class="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
	<div class="mx-auto max-w-2xl px-4 py-3">
		<div class="flex flex-col gap-2">
			{#if previewUrl}
				<div class="relative inline-block w-fit">
					<img src={previewUrl} alt="Selected" class="h-16 rounded-md object-cover" />
					<button
						type="button"
						onclick={clearImage}
						class="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
						aria-label={m.manual_remove_image()}
					>
						<X size={12} />
					</button>
				</div>
			{/if}
			<Input
				type="text"
				bind:value={description}
				placeholder={m.input_placeholder()}
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
					onclick={() => fileInput?.click()}
					disabled={loading}
					class="text-muted-foreground"
				>
					<Camera size={18} />
				</Button>
				<input
					type="file"
					accept="image/*"
					onchange={handleFileSelect}
					bind:this={fileInput}
					class="sr-only"
				/>
				<div class="flex-1"></div>
				<Button
					variant="default"
					size="sm"
					onclick={handleAiSubmit}
					disabled={loading || (!description.trim() && !selectedImage)}
				>
					{#if loading}
						<Loader2 size={16} class="animate-spin" />
					{:else}
						<Sparkles size={16} />
					{/if}
					{m.input_ai_button()}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={onManualEntry}
					disabled={loading}
				>
					<Pencil size={16} />
					{m.input_manual_button()}
				</Button>
			</div>
		</div>
	</div>
</div>
