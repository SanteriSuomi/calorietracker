import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { API_BASE, AUTH_API_ROUTE, AUTH_PAGE_ROUTE } from '$lib/server/constants';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handleAuthGuard: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const { pathname } = event.url;
	const isAuthPage = pathname === AUTH_PAGE_ROUTE;
	const isApiRoute = pathname.startsWith(API_BASE);

	if (pathname.startsWith(AUTH_API_ROUTE)) {
		return resolve(event);
	}

	if (!event.locals.user) {
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (!isAuthPage) {
			return new Response(null, {
				status: 302,
				headers: { Location: AUTH_PAGE_ROUTE }
			});
		}
	} else if (isAuthPage) {
		return new Response(null, {
			status: 302,
			headers: { Location: '/' }
		});
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleBetterAuth, handleAuthGuard);
