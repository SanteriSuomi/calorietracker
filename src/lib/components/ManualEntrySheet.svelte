<script lang="ts">
	import { Sheet, SheetContent, SheetTitle, SheetDescription } from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import type { Meal, MealFormData } from '$lib/types';
	import { isValidDate, today } from '$lib/utils/date';

	let {
		open = $bindable(false),
		meal = undefined,
		date,
		onSubmit,
		onClose
	}: {
		open?: boolean;
		meal?: Meal | null;
		date: string;
		onSubmit: (data: MealFormData) => Promise<void>;
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

	$effect(() => {
		if (open) {
			description = meal?.description ?? '';
			calories = meal?.calories?.toString() ?? '';
			protein = meal?.protein?.toString() ?? '0';
			carbs = meal?.carbs?.toString() ?? '0';
			fat = meal?.fat?.toString() ?? '0';
			dateInput = date;
			errors = {};
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
			await onSubmit({
				description: description.trim(),
				calories: Number.parseInt(calories, 10),
				protein: Number.parseInt(protein || '0', 10),
				carbs: Number.parseInt(carbs || '0', 10),
				fat: Number.parseInt(fat || '0', 10),
				date: dateInput
			});
			open = false;
		} catch {
			errors.date = 'Failed to save meal';
		} finally {
			submitting = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Sheet bind:open>
	<SheetContent side="bottom" onInteractOutside={handleClose} onEscapeKeydown={handleClose}>
		<SheetTitle>{meal ? 'Edit Meal' : 'Add Meal'}</SheetTitle>
		<SheetDescription>{meal ? 'Update meal details' : 'Log a new meal'}</SheetDescription>

		<form onsubmit={handleSubmit} class="flex flex-col gap-3 mt-2">
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">Description</span>
				<input
					type="text"
					bind:value={description}
					class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="e.g. Chicken breast with rice"
				/>
				{#if errors.description}<span class="text-xs text-destructive">{errors.description}</span>{/if}
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">Calories</span>
				<input
					type="number"
					bind:value={calories}
					min="0"
					class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="500"
				/>
				{#if errors.calories}<span class="text-xs text-destructive">{errors.calories}</span>{/if}
			</label>

			<div class="grid grid-cols-3 gap-2">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Protein (g)</span>
					<input
						type="number"
						bind:value={protein}
						min="0"
						class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					/>
					{#if errors.protein}<span class="text-xs text-destructive">{errors.protein}</span>{/if}
				</label>

				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Carbs (g)</span>
					<input
						type="number"
						bind:value={carbs}
						min="0"
						class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					/>
					{#if errors.carbs}<span class="text-xs text-destructive">{errors.carbs}</span>{/if}
				</label>

				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Fat (g)</span>
					<input
						type="number"
						bind:value={fat}
						min="0"
						class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					/>
					{#if errors.fat}<span class="text-xs text-destructive">{errors.fat}</span>{/if}
				</label>
			</div>

			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">Date</span>
				<input
					type="text"
					bind:value={dateInput}
					class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="YYYY-MM-DD"
				/>
				{#if errors.date}<span class="text-xs text-destructive">{errors.date}</span>{/if}
			</label>

			<div class="flex gap-2 mt-2">
				<Button type="button" variant="outline" onclick={handleClose} class="flex-1">Cancel</Button>
				<Button type="submit" disabled={submitting} class="flex-1">
					{submitting ? 'Saving...' : meal ? 'Update' : 'Add Meal'}
				</Button>
			</div>
		</form>
	</SheetContent>
</Sheet>
