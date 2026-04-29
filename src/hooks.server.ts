import type { Handle, RequestEvent } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { API_BASE, AUTH_API_ROUTE, AUTH_PAGE_ROUTE } from '$lib/server/constants';
import { logger } from '$lib/server/logger';
import type { WideEvent } from '$lib/server/types/logging';
import { toLogError } from '$lib/server/types/logging';

function emitWideEvent(
	event: RequestEvent,
	statusCode: number,
	startTime: number,
	thrownError?: unknown
): void {
	const duration_ms = Date.now() - startTime;
	const method = event.request.method;
	const path = event.url.pathname;
	const userId = event.locals.user?.id ?? 'anonymous';
	const logContext = event.locals.logContext ?? {};
	const isServerError = statusCode >= 500;
	const outcome = isServerError ? 'error' : 'success';
	const detail = (logContext.detail as string) ?? `${method} ${path}`;

	const wideEvent: WideEvent = {
		method,
		path,
		requestId: event.locals.requestId ?? '',
		userId,
		statusCode,
		duration_ms,
		outcome,
		detail,
		...logContext
	};

	if (thrownError) {
		wideEvent.error = toLogError(thrownError);
	}

	if (isServerError) {
		logger.error(wideEvent);
	} else {
		logger.info(wideEvent);
	}
}

const handleLogging: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	event.locals.requestId = crypto.randomUUID();
	event.locals.logContext = {};

	const startTime = Date.now();

	try {
		const response = await resolve(event);
		emitWideEvent(event, response.status, startTime);
		return response;
	} catch (error) {
		emitWideEvent(event, 500, startTime, error);
		throw error;
	}
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	try {
		const session = await auth.api.getSession({ headers: event.request.headers });
		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}
	} catch (error) {
		logger.error({
			method: event.request.method,
			path: event.url.pathname,
			detail: 'Session extraction failed',
			error: toLogError(error)
		});
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

export const handle: Handle = sequence(handleLogging, handleBetterAuth, handleAuthGuard);
