<script lang="ts">
	import { enhance } from '$app/forms';
	
		
			let { form } = $props();
		
			let mode = $state<'signin' | 'signup'>('signin');
</script>

<svelte:head>
	<title>{mode === 'signin' ? 'Sign In' : 'Sign Up'} — CalorieTracker</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-sm">
		<h1 class="mb-8 text-center text-2xl font-bold text-gray-900">CalorieTracker</h1>

		{#if form?.message}
			<div
				class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
				role="alert"
			>
				{form.message}
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
					Sign In
				</button>
				<button
					type="button"
					onclick={() => (mode = 'signup')}
					class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {mode ===
					'signup'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'}"
				>
					Sign Up
				</button>
			</div>

			{#if mode === 'signin'}
				<form method="POST" action="?/signIn" use:enhance>
					<div class="space-y-4">
						<div>
							<label for="email" class="mb-1.5 block text-sm font-medium text-gray-700">Email</label
							>
							<input
								id="email"
								name="email"
								type="email"
								required
								autocomplete="email"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="you@example.com"
							/>
						</div>
						<div>
							<label for="password" class="mb-1.5 block text-sm font-medium text-gray-700"
								>Password</label
							>
							<input
								id="password"
								name="password"
								type="password"
								required
								autocomplete="current-password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="••••••••"
							/>
						</div>
						<button
							type="submit"
							class="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none"
						>
							Sign In
						</button>
					</div>
				</form>
			{:else}
				<form method="POST" action="?/signUp" use:enhance>
					<div class="space-y-4">
						<div>
							<label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								autocomplete="name"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Your name"
							/>
						</div>
						<div>
							<label for="signup-email" class="mb-1.5 block text-sm font-medium text-gray-700"
								>Email</label
							>
							<input
								id="signup-email"
								name="email"
								type="email"
								required
								autocomplete="email"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="you@example.com"
							/>
						</div>
						<div>
							<label for="signup-password" class="mb-1.5 block text-sm font-medium text-gray-700"
								>Password</label
							>
							<input
								id="signup-password"
								name="password"
								type="password"
								required
								minlength="8"
								autocomplete="new-password"
								class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Min. 8 characters"
							/>
						</div>
						<button
							type="submit"
							class="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none"
						>
							Create Account
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
