import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	signIn: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({
				body: { email, password }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Sign in failed', mode: 'signin' });
			}
			return fail(500, { message: 'Unexpected error', mode: 'signin' });
		}

		return redirect(302, '/');
	},
	signUp: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		try {
			await auth.api.signUpEmail({
				body: { email, password, name }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed', mode: 'signup' });
			}
			return fail(500, { message: 'Unexpected error', mode: 'signup' });
		}

		return redirect(302, '/');
	}
} satisfies Actions;
