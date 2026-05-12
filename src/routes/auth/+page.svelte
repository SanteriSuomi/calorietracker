<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
					import { enhance } from '$app/forms';
						import { m } from '$lib/paraglide/messages';
		import { localizeHref } from '$lib/paraglide/runtime';
	
		
			
				
						let { form, data } = $props();
				
						let mode = $state<'signin' | 'signup'>('signin');
						let submitting = $state(false);
</script>

<svelte:head>
	<title>{mode === 'signin' ? m.auth_title_sign_in() : m.auth_title_sign_up()} — {m.app_name()}</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-sm">
		<h1 class="mb-8 text-center text-2xl font-bold text-gray-900">{m.app_name()}</h1>

		{#if form?.message}
			<div
				class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
				role="alert"
			>
				{form.message}
			</div>
		{/if}

		{#if form?.emailNotVerified}
			<div
				class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700"
				role="alert"
			>
				{m.auth_email_not_verified()}
			</div>
		{/if}

		{#if data?.verified}
			<div
				class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
				role="status"
			>
				{m.auth_email_verified()}
			</div>
		{/if}

		{#if data?.verifyError === 'TOKEN_EXPIRED'}
			<div
				class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700"
				role="alert"
			>
				{m.auth_verify_expired()}
			</div>
		{:else if data?.verifyError}
			<div
				class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
				role="alert"
			>
				{m.auth_verify_invalid()}
			</div>
		{/if}

		{#if data?.passwordReset}
			<div
				class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
				role="status"
			>
				{m.auth_password_reset_success()}
			</div>
		{/if}

		<div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
			<div class="mb-6 flex rounded-lg bg-gray-100 p-1">
				<button
					type="button"
					onclick={() => (mode = 'signin')}
					class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {mode ===
					'signin'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'}"
				>
					{m.auth_tab_sign_in()}
				</button>
				<button
					type="button"
					onclick={() => (mode = 'signup')}
					class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {mode ===
					'signup'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'}"
				>
					{m.auth_tab_sign_up()}
				</button>
			</div>

			{#if mode === 'signin'}
				<form method="POST" action="?/signIn" use:enhance={() => {
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
								placeholder={m.auth_email_placeholder()}
							/>
						</div>
						<div>
							<label for="password" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_password_label()}</label>
							<input
								id="password"
								name="password"
								type="password"
								required
								autocomplete="current-password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_password_placeholder_sign_in()}
							/>
						</div>
						<div class="flex justify-end">
							<a
								href={localizeHref('/auth/forgot-password')}
								class="text-sm font-medium text-blue-600 hover:text-blue-500"
							>
								{m.auth_forgot_password_link()}
							</a>
						</div>
						<button
							type="submit"
							disabled={submitting}
							class="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
						>
							{#if submitting}
								<Loader2 size={16} class="animate-spin" />
							{/if}
							{m.auth_submit_sign_in()}
						</button>
					</div>
				</form>
			{:else}
				<form method="POST" action="?/signUp" use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}>
					<div class="space-y-4">
						<div>
							<label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_name_label()}</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								autocomplete="name"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_name_placeholder()}
							/>
						</div>
						<div>
							<label for="signup-email" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_email_label()}</label>
							<input
								id="signup-email"
								name="email"
								type="email"
								required
								autocomplete="email"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_email_placeholder()}
							/>
						</div>
						<div>
							<label for="signup-password" class="mb-1.5 block text-sm font-medium text-gray-700">{m.auth_password_label()}</label>
							<input
								id="signup-password"
								name="password"
								type="password"
								required
								minlength="8"
								autocomplete="new-password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder={m.auth_password_placeholder_sign_up()}
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
							{m.auth_submit_sign_up()}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
