import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getLocale } from '$lib/paraglide/runtime';
import { auth } from '$lib/server/auth';
import { addLogContext } from '$lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

function localizedHome(): string {
	const locale = getLocale();
	return locale === 'en' ? '/' : `/${locale}/`;
}

function localizedAuth(): string {
	const locale = getLocale();
	return locale === 'en' ? '/auth' : `/${locale}/auth`;
}

function serializeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'object' && error !== null) {
		const obj = error as Record<string, unknown>;
		if (typeof obj.message === 'string') return obj.message;
		return JSON.stringify(error);
	}
	return String(error);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		return redirect(302, localizedHome());
	}
	const token = url.searchParams.get('token');
	return { token };
};

export const actions: Actions = {
	resetPassword: async ({ request, locals }) => {
		const formData = await request.formData();
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';
		const token = formData.get('token')?.toString() ?? '';

		if (newPassword.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters', token });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'Passwords do not match', token });
		}

		try {
			await auth.api.resetPassword({
				body: { newPassword, token }
			});
			addLogContext(locals, {
				detail: 'Password reset successful',
				authAction: 'resetPassword'
			});
			return redirect(302, `${localizedAuth()}?reset=success`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			const message = serializeError(error);
			const isApiError =
				error instanceof APIError ||
				(typeof error === 'object' && error !== null && 'statusCode' in error);
			addLogContext(locals, {
				detail: `Password reset failed: ${message}`,
				authAction: 'resetPassword',
				authError: message
			});
			return fail(isApiError ? 400 : 500, { message, token });
		}
	}
} satisfies Actions;
