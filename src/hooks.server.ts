import type { Handle, RequestEvent } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { deLocalizeUrl, getLocale, getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { auth } from '$lib/server/auth';
import { API_BASE, AUTH_API_ROUTE, AUTH_PAGE_ROUTE } from '$lib/server/constants';
import { logger } from '$lib/server/logger';
import { requestCounter } from '$lib/server/metrics';
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
		requestCounter.inc({
			method: event.request.method,
			path: event.url.pathname,
			status: response.status
		});
		return response;
	} catch (error) {
		emitWideEvent(event, 500, startTime, error);
		requestCounter.inc({
			method: event.request.method,
			path: event.url.pathname,
			status: 500
		});
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

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale));
			}
		});
	});

const handleAuthGuard: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const { pathname } = event.url;
	const canonicalPath = deLocalizeUrl(event.url).pathname;
	const isAuthPage =
		canonicalPath === AUTH_PAGE_ROUTE || canonicalPath.startsWith(`${AUTH_PAGE_ROUTE}/`);
	const isApiRoute = pathname.startsWith(API_BASE);
	const isPublicEndpoint =
		pathname === '/api/health' || pathname === '/api/metrics';

	if (pathname.startsWith(AUTH_API_ROUTE)) {
		return resolve(event);
	}

	if (isPublicEndpoint) {
		return resolve(event);
	}

	if (env.AZURE_DEPLOYMENT === 'true' && !isPublicEndpoint) {
		const cfIp = event.request.headers.get('CF-Connecting-IP');
		if (!cfIp) {
			logger.warn({
				method: event.request.method,
				path: pathname,
				detail: 'Request bypassed Cloudflare — missing CF-Connecting-IP header'
			});
			return new Response('Forbidden', { status: 403 });
		}
	}

	const disableAuth = env.DISABLE_AUTH === 'true';
	if (disableAuth && env.AZURE_DEPLOYMENT === 'true') {
		logger.fatal('DISABLE_AUTH=true with AZURE_DEPLOYMENT=true is not allowed');
		process.exit(1);
	}

	if (disableAuth) {
		const { ensureDefaultUser } = await import('$lib/server/auth');
		const defaultUser = await ensureDefaultUser();
		event.locals.user = {
			id: defaultUser.id,
			name: defaultUser.name,
			email: defaultUser.email,
			emailVerified: true,
			image: null,
			createdAt: defaultUser.createdAt,
			updatedAt: defaultUser.updatedAt
		};
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
			const locale = getLocale();
			const authRedirect = locale === 'en' ? AUTH_PAGE_ROUTE : `/${locale}${AUTH_PAGE_ROUTE}`;
			return new Response(null, {
				status: 302,
				headers: { Location: authRedirect }
			});
		}
	} else if (isAuthPage) {
		const locale = getLocale();
		const homeRedirect = locale === 'en' ? '/' : `/${locale}/`;
		return new Response(null, {
			status: 302,
			headers: { Location: homeRedirect }
		});
	}

	return resolve(event);
};

export const handle: Handle = sequence(
	handleParaglide,
	handleLogging,
	handleBetterAuth,
	handleAuthGuard
);
