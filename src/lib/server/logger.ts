import pino from 'pino';
import type { LogContext, LogLevel } from './types/logging';

/**
 * Pino logger singleton.
 *
 * LOG_LEVEL env var controls minimum log level:
 * - "verbose" → trace (everything)
 * - "info"    → info (default)
 * - "error"   → error only
 * - "none"    → silent
 * - unset/unrecognized → info
 *
 * Code uses only `logger.info()` and `logger.error()`.
 * Dev (import.meta.env.DEV) → pino-pretty (human-readable).
 * Prod → raw JSON lines to stdout.
 */
const LOG_LEVEL_MAP: Record<LogLevel, pino.LevelWithSilent> = {
	verbose: 'trace',
	info: 'info',
	error: 'error',
	none: 'silent'
};

export function resolveLevel(envValue: string | undefined): pino.LevelWithSilent {
	if (envValue && envValue in LOG_LEVEL_MAP) return LOG_LEVEL_MAP[envValue as LogLevel];
	return 'info';
}

const isDev = import.meta.env.DEV;

export const logger = pino(
	isDev
		? { level: resolveLevel(process.env.LOG_LEVEL), transport: { target: 'pino-pretty' } }
		: { level: resolveLevel(process.env.LOG_LEVEL) }
);

export function addLogContext(locals: App.Locals, data: LogContext): void {
	locals.logContext = { ...locals.logContext, ...data };
}
