import { getMetrics } from '$lib/server/metrics';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const body = await getMetrics();
	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' }
	});
};
