import type { User, Session } from 'better-auth/minimal';
import type { LogContext } from '$lib/server/types/logging';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			requestId?: string;
			logContext?: LogContext;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
