import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
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

export const actions: Actions = {
	signIn: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({
				body: { email, password }
			});
			addLogContext(locals, {
				detail: 'Sign-in successful',
				authAction: 'signIn'
			});
		} catch (error) {
			if (error instanceof APIError) {
				addLogContext(locals, {
					detail: `Sign-in failed: ${error.message}`,
					authAction: 'signIn',
					authError: error.message
				});
				return fail(400, { message: error.message || 'Sign in failed', mode: 'signin' });
			}
			addLogContext(locals, {
				detail: `Sign-in failed: ${error instanceof Error ? error.message : String(error)}`,
				authAction: 'signIn'
			});
			return fail(500, { message: 'Unexpected error', mode: 'signin' });
		}

		return redirect(302, localizedHome());
	},
	signUp: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		try {
			await auth.api.signUpEmail({
				body: { email, password, name }
			});
			addLogContext(locals, {
				detail: 'Sign-up successful',
				authAction: 'signUp'
			});
		} catch (error) {
			if (error instanceof APIError) {
				addLogContext(locals, {
					detail: `Sign-up failed: ${error.message}`,
					authAction: 'signUp',
					authError: error.message
				});
				return fail(400, { message: error.message || 'Registration failed', mode: 'signup' });
			}
			addLogContext(locals, {
				detail: `Sign-up failed: ${error instanceof Error ? error.message : String(error)}`,
				authAction: 'signUp'
			});
			return fail(500, { message: 'Unexpected error', mode: 'signup' });
		}

		return redirect(302, localizedHome());
	}
} satisfies Actions;
