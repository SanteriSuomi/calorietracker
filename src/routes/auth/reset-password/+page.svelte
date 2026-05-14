<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
								import { enhance } from '$app/forms';
								import { m } from '$lib/paraglide/messages';
								import { localizeHref } from '$lib/paraglide/runtime';
	
		
			
				
					
						
								let { form, data } = $props();
								let submitting = $state(false);
						
								let hasToken = $derived(!!data?.token);
</script>

<svelte:head>
	<title>{m.auth_reset_password_title()}</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-sm">
		<h1 class="mb-8 text-center text-2xl font-bold text-gray-900">{m.app_name()}</h1>

		<div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
			{#if !hasToken}
				<div class="text-center">
					<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{m.auth_reset_password_invalid_token()}
					</div>
					<a
						href={localizeHref('/auth/forgot-password')}
						class="text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						{m.auth_forgot_password_submit()}
					</a>
				</div>
			{:else}
				<h2 class="mb-6 text-lg font-semibold text-gray-900">{m.auth_reset_password_heading()}</h2>

				{#if form?.message}
					<div
						class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
						role="alert"
					>
						{form.message}
					</div>
				{/if}

				<form method="POST" action="?/resetPassword" use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}>
					<div class="space-y-4">
						<input type="hidden" name="token" value={data.token} />
						<div>
							<label for="newPassword" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_reset_password_new_password_label()}</label>
							<input
								id="newPassword"
								name="newPassword"
								type="password"
								required
								minlength="8"
								autocomplete="new-password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_reset_password_new_password_placeholder()}
							/>
						</div>
						<div>
							<label for="confirmPassword" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_reset_password_confirm_label()}</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								required
								minlength="8"
								autocomplete="new-password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_reset_password_confirm_placeholder()}
							/>
						</div>
						<button
							type="submit"
							disabled={submitting}
							class="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
						>
							{#if submitting}
								<Loader2 size={16} class="animate-spin" />
							{/if}
							{m.auth_reset_password_submit()}
						</button>
					</div>
				</form>

				<div class="mt-4 text-center">
					<a
						href={localizeHref('/auth')}
						class="text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						{m.auth_reset_password_back()}
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
