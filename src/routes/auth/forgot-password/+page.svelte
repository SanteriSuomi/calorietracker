<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
								import { enhance } from '$app/forms';
								import { m } from '$lib/paraglide/messages';
								import { localizeHref } from '$lib/paraglide/runtime';
	
		
			
				
					
						
								let { form } = $props();
								let submitting = $state(false);
</script>

<svelte:head>
	<title>{m.auth_forgot_password_title()} — {m.app_name()}</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-sm">
		<h1 class="mb-8 text-center text-2xl font-bold text-gray-900">{m.app_name()}</h1>

		<div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
			{#if form?.success}
				<div class="text-center">
					<div class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
						{m.auth_forgot_password_success()}
					</div>
					<a
						href={localizeHref('/auth')}
						class="text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						{m.auth_forgot_password_back()}
					</a>
				</div>
			{:else}
				<h2 class="mb-2 text-lg font-semibold text-gray-900">{m.auth_forgot_password_heading()}</h2>
				<p class="mb-6 text-sm text-gray-500">{m.auth_forgot_password_desc()}</p>

				<form method="POST" action="?/requestReset" use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}>
					<div class="space-y-4">
						<div>
							<label for="email" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_email_label()}</label>
							<input
								id="email"
								name="email"
								type="email"
								required
								autocomplete="email"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_forgot_password_email_placeholder()}
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
							{m.auth_forgot_password_submit()}
						</button>
					</div>
				</form>

				<div class="mt-4 text-center">
					<a
						href={localizeHref('/auth')}
						class="text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						{m.auth_forgot_password_back()}
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
