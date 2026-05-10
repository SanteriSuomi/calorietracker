<script lang="ts">
	import { Camera, X } from '@lucide/svelte';
			import { Button } from '$lib/components/ui/button';
			import { Input } from '$lib/components/ui/input';
			import { Label } from '$lib/components/ui/label';
			import { Sheet, SheetContent, SheetDescription, SheetTitle } from '$lib/components/ui/sheet';
			import { m } from '$lib/paraglide/messages';
			import type { Meal, MealFormData } from '$lib/types';
			import { isValidDate, today } from '$lib/utils/date';
	
			let {
				open = $bindable(false),
				meal = undefined,
				prefill = undefined,
				date,
				imageFilename: existingImageFilename = undefined,
				onSubmit,
				onClose
			}: {
				open?: boolean;
				meal?: Meal | null;
				prefill?: MealFormData | null;
				date: string;
				imageFilename?: string | null;
				onSubmit: (data: MealFormData, imageFile?: File, removeExistingImage?: boolean) => Promise<void>;
				onClose: () => void;
			} = $props();
	
			let description = $state('');
			let calories = $state('');
			let protein = $state('0');
			let carbs = $state('0');
			let fat = $state('0');
			let dateInput = $state('');
			let submitting = $state(false);
			let errors = $state<Record<string, string>>({});
			let selectedFile = $state<File | null>(null);
			let previewUrl = $state<string | null>(null);
			let removeImage = $state(false);
	
			$effect(() => {
				if (open) {
					if (meal) {
						description = meal.description ?? '';
						calories = meal.calories?.toString() ?? '';
						protein = meal.protein?.toString() ?? '0';
						carbs = meal.carbs?.toString() ?? '0';
						fat = meal.fat?.toString() ?? '0';
					} else if (prefill) {
						description = prefill.description ?? '';
						calories = prefill.calories?.toString() ?? '';
						protein = prefill.protein?.toString() ?? '0';
						carbs = prefill.carbs?.toString() ?? '0';
						fat = prefill.fat?.toString() ?? '0';
					} else {
						description = '';
						calories = '';
						protein = '0';
						carbs = '0';
						fat = '0';
					}
					dateInput = date;
					errors = {};
					selectedFile = null;
					removeImage = false;
				}
			});
	
			$effect(() => {
				if (selectedFile) {
					if (previewUrl) URL.revokeObjectURL(previewUrl);
					previewUrl = URL.createObjectURL(selectedFile);
				} else if (previewUrl) {
					URL.revokeObjectURL(previewUrl);
					previewUrl = null;
				}
			});
	
			function validate(): Record<string, string> {
				const errs: Record<string, string> = {};
				if (!description.trim()) errs.description = 'Description is required';
				const cal = Number.parseInt(calories, 10);
				if (calories === '' || !Number.isInteger(cal) || cal < 0) errs.calories = 'Calories must be a non-negative integer';
				const p = Number.parseInt(protein, 10);
				if (protein !== '' && (!Number.isInteger(p) || p < 0)) errs.protein = 'Must be a non-negative integer';
				const c = Number.parseInt(carbs, 10);
				if (carbs !== '' && (!Number.isInteger(c) || c < 0)) errs.carbs = 'Must be a non-negative integer';
				const f = Number.parseInt(fat, 10);
				if (fat !== '' && (!Number.isInteger(f) || f < 0)) errs.fat = 'Must be a non-negative integer';
				if (!isValidDate(dateInput)) errs.date = 'Must be YYYY-MM-DD format';
				else if (dateInput > today()) errs.date = 'Date cannot be in the future';
				return errs;
			}
	
			async function handleSubmit(e: SubmitEvent) {
				e.preventDefault();
				const errs = validate();
				if (Object.keys(errs).length > 0) {
					errors = errs;
					return;
				}
				submitting = true;
				try {
					await onSubmit(
						{
							description: description.trim(),
							calories: Number.parseInt(calories, 10),
							protein: Number.parseInt(protein || '0', 10),
							carbs: Number.parseInt(carbs || '0', 10),
							fat: Number.parseInt(fat || '0', 10),
							date: dateInput
						},
						selectedFile ?? undefined,
						removeImage || undefined
					);
					open = false;
				} catch {
					errors.date = m.error_save_meal();
				} finally {
					submitting = false;
				}
			}
	
			function handleClose() {
				open = false;
				selectedFile = null;
				removeImage = false;
				onClose();
			}
	
			function handleFileSelect(e: Event) {
				const input = e.target as HTMLInputElement;
				if (input.files && input.files[0]) {
					selectedFile = input.files[0];
					removeImage = false;
				}
			}
	
			function clearSelectedFile() {
				selectedFile = null;
			}
	
			function handleRemoveExistingImage() {
				removeImage = true;
			}
</script>

<Sheet bind:open>
	<SheetContent side="bottom" onInteractOutside={handleClose} onEscapeKeydown={handleClose}>
		<SheetTitle>{meal ? m.manual_title_edit() : prefill ? m.manual_title_add_ai() : m.manual_title_add()}</SheetTitle>
		<SheetDescription>{meal ? m.manual_desc_edit() : m.manual_desc_add()}</SheetDescription>

		<form onsubmit={handleSubmit} class="flex flex-col gap-3 mt-2">
			<div class="flex flex-col gap-1">
				<Label for="meal-description">{m.manual_description_label()}</Label>
				<Input
					id="meal-description"
					type="text"
					bind:value={description}
					placeholder={m.manual_description_placeholder()}
				/>
				{#if errors.description}<span class="text-xs text-destructive">{errors.description}</span>{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if previewUrl}
					<div class="relative">
						<img src={previewUrl} alt={m.manual_preview_alt()} class="w-16 h-16 rounded-md object-cover" />
						<button
							type="button"
							onclick={clearSelectedFile}
							class="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
							aria-label={m.manual_remove_image()}
						>
							<X size={12} />
						</button>
					</div>
				{:else if existingImageFilename && !removeImage}
					<div class="relative">
						<img
							src={`/api/images/${existingImageFilename}`}
							alt={description || m.manual_meal_photo_alt()}
							class="w-16 h-16 rounded-md object-cover"
						/>
						<button
							type="button"
							onclick={handleRemoveExistingImage}
							class="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
							aria-label={m.manual_remove_image()}
						>
							<X size={12} />
						</button>
					</div>
				{/if}
				<label class="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors">
					<Camera size={16} />
					<span>{selectedFile || (existingImageFilename && !removeImage) ? m.manual_change_photo() : m.manual_add_photo()}</span>
					<input type="file" accept="image/*" onchange={handleFileSelect} class="hidden" />
				</label>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="meal-calories">{m.manual_calories_label()}</Label>
				<Input
					id="meal-calories"
					type="number"
					bind:value={calories}
					min="0"
					placeholder={m.manual_calories_placeholder()}
				/>
				{#if errors.calories}<span class="text-xs text-destructive">{errors.calories}</span>{/if}
			</div>

			<div class="grid grid-cols-3 gap-2">
				<div class="flex flex-col gap-1">
					<Label for="meal-protein">{m.manual_protein_label()}</Label>
					<Input
						id="meal-protein"
						type="number"
						bind:value={protein}
						min="0"
					/>
					{#if errors.protein}<span class="text-xs text-destructive">{errors.protein}</span>{/if}
				</div>

				<div class="flex flex-col gap-1">
					<Label for="meal-carbs">{m.manual_carbs_label()}</Label>
					<Input
						id="meal-carbs"
						type="number"
						bind:value={carbs}
						min="0"
					/>
					{#if errors.carbs}<span class="text-xs text-destructive">{errors.carbs}</span>{/if}
				</div>

				<div class="flex flex-col gap-1">
					<Label for="meal-fat">{m.manual_fat_label()}</Label>
					<Input
						id="meal-fat"
						type="number"
						bind:value={fat}
						min="0"
					/>
					{#if errors.fat}<span class="text-xs text-destructive">{errors.fat}</span>{/if}
				</div>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="meal-date">{m.manual_date_label()}</Label>
				<Input
					id="meal-date"
					type="text"
					bind:value={dateInput}
					placeholder={m.manual_date_placeholder()}
				/>
				{#if errors.date}<span class="text-xs text-destructive">{errors.date}</span>{/if}
			</div>

			<div class="flex gap-2 mt-2">
				<Button type="button" variant="outline" onclick={handleClose} class="flex-1">{m.manual_cancel()}</Button>
				<Button type="submit" disabled={submitting} class="flex-1">
					{submitting ? m.manual_saving() : meal ? m.manual_update() : m.manual_add_meal()}
				</Button>
			</div>
		</form>
	</SheetContent>
</Sheet>
