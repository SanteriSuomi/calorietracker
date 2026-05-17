import client from 'prom-client';

const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

export const requestCounter = new client.Counter({
	name: 'http_requests_total',
	help: 'Total HTTP requests',
	labelNames: ['method', 'path', 'status'],
	registers: [registry]
});

export const aiCallCounter = new client.Counter({
	name: 'ai_calls_total',
	help: 'Total AI API calls',
	labelNames: ['source', 'model', 'status'],
	registers: [registry]
});

export const mealCounter = new client.Counter({
	name: 'meals_created_total',
	help: 'Total meals created',
	labelNames: ['source'],
	registers: [registry]
});

export async function getMetrics(): Promise<string> {
	return registry.metrics();
}
