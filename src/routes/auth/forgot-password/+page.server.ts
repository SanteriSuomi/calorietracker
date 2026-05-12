import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getLocale } from '$lib/paraglide/runtime';
import { auth } from '$lib/server/auth';
import { addLogContext } from '$lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

function localizedHome(): string {
	const locale = getLocale();
	return locale === 'en' ? '/' : `/${locale}/`;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		return redirect(302, localizedHome());
	}
	return {};
};

	function serializeError(error: unknown): string {
		if (error instanceof Error) return error.message;
		if (typeof error === 'object' && error !== null) {
			const obj = error as Record<string, unknown>;
			if (typeof obj.message === 'string') return obj.message;
			return JSON.stringify(error);
		}
		return String(error);
	}

	export const actions: Actions = {
		requestReset: async ({ request, locals, url }) => {
			const formData = await request.formData();
			const email = formData.get('email')?.toString() ?? '';

			const redirectTo = `${env.ORIGIN || url.origin}/auth/reset-password`;

			try {
				await auth.api.requestPasswordReset({
					body: { email, redirectTo }
				});
				addLogContext(locals, {
					detail: 'Password reset requested',
					authAction: 'requestPasswordReset'
				});
			} catch (error) {
				addLogContext(locals, {
					detail: `Password reset request failed: ${serializeError(error)}`,
					authAction: 'requestPasswordReset'
				});
			}

			return { success: true };
		}
	} satisfies Actions;
