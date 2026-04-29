export type LogLevel = 'verbose' | 'info' | 'error' | 'none';

export type WideEventOutcome = 'success' | 'error';

export interface LogError {
	message: string;
	type: string;
}

export interface WideEvent {
	method: string;
	path: string;
	requestId: string;
	userId: string;
	statusCode: number;
	duration_ms: number;
	outcome: WideEventOutcome;
	detail: string;
	error?: LogError;
	[key: string]: unknown;
}

export interface LogContext extends Record<string, unknown> {
	detail?: string;
}

export function toLogError(error: unknown): LogError {
	return {
		message: error instanceof Error ? error.message : String(error),
		type: error instanceof Error ? error.constructor.name : 'Unknown'
	};
}
