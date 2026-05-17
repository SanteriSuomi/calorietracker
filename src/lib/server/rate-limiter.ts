import { env } from '$env/dynamic/private';
import { databaseProvider } from '$lib/server/db';

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
}

interface RateLimiter {
	check(ip: string): Promise<RateLimitResult>;
}

class InMemoryRateLimiter implements RateLimiter {
	private windows = new Map<string, { count: number; expires: number }>();
	private readonly limit: number;
	private readonly windowMs: number;

	constructor(limit = 30, windowMs = 60_000) {
		this.limit = limit;
		this.windowMs = windowMs;
	}

	async check(ip: string): Promise<RateLimitResult> {
		const now = Date.now();
		const entry = this.windows.get(ip);

		if (!entry || now >= entry.expires) {
			this.windows.set(ip, { count: 1, expires: now + this.windowMs });
			return { allowed: true, remaining: this.limit - 1 };
		}

		entry.count++;
		if (entry.count > this.limit) {
			return { allowed: false, remaining: 0 };
		}
		return { allowed: true, remaining: this.limit - entry.count };
	}
}

class PgRateLimiter implements RateLimiter {
	private readonly limit: number;
	private readonly windowSeconds: number;
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;
	private initialized = false;

	constructor(limit = 30, windowSeconds = 60) {
		this.limit = limit;
		this.windowSeconds = windowSeconds;
	}

	private async init() {
		if (this.initialized) return;
		this.initialized = true;

		const { db } = await import('$lib/server/db');
		const { sql } = await import('drizzle-orm');

		await db.run(sql`CREATE TABLE IF NOT EXISTS rate_limits (
			ip TEXT NOT NULL,
			window_start TIMESTAMPTZ NOT NULL,
			count INTEGER NOT NULL DEFAULT 1,
			PRIMARY KEY (ip, window_start)
		)`);

		this.cleanupInterval = setInterval(
			() => {
				db.run(
					sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 hour'`
				).catch(() => {});
			},
			10 * 60 * 1000
		);
	}

	async check(ip: string): Promise<RateLimitResult> {
		await this.init();

		const { db } = await import('$lib/server/db');
		const { sql } = await import('drizzle-orm');

		const windowStart = new Date(
			Math.floor(Date.now() / (this.windowSeconds * 1000)) * this.windowSeconds * 1000
		).toISOString();

		const result = await db.run(
			sql`INSERT INTO rate_limits (ip, window_start, count)
				VALUES (${ip}, ${windowStart}, 1)
				ON CONFLICT (ip, window_start)
				DO UPDATE SET count = rate_limits.count + 1
				RETURNING count`
		);

		const count = result.rows[0]?.count as number | undefined;
		const currentCount = typeof count === 'number' ? count : 1;

		if (currentCount > this.limit) {
			return { allowed: false, remaining: 0 };
		}
		return { allowed: true, remaining: this.limit - currentCount };
	}

	destroy() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}
}

let instance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
	if (instance) return instance;

	if (databaseProvider === 'pg') {
		instance = new PgRateLimiter();
	} else {
		instance = new InMemoryRateLimiter();
	}

	return instance;
}
