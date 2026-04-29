import { describe, expect, it } from 'vitest';
import { addLogContext, resolveLevel } from '$lib/server/logger';

describe('resolveLevel', () => {
	it('maps verbose to trace', () => {
		expect(resolveLevel('verbose')).toBe('trace');
	});

	it('maps info to info', () => {
		expect(resolveLevel('info')).toBe('info');
	});

	it('maps error to error', () => {
		expect(resolveLevel('error')).toBe('error');
	});

	it('maps none to silent', () => {
		expect(resolveLevel('none')).toBe('silent');
	});

	it('defaults to info when undefined', () => {
		expect(resolveLevel(undefined)).toBe('info');
	});

	it('defaults to info for unrecognized values', () => {
		expect(resolveLevel('bogus')).toBe('info');
	});
});

describe('addLogContext', () => {
	it('merges data into empty logContext', () => {
		const locals: App.Locals = {};
		addLogContext(locals, { detail: 'test' });
		expect(locals.logContext).toEqual({ detail: 'test' });
	});

	it('merges data into existing logContext preserving previous keys', () => {
		const locals: App.Locals = { logContext: { mealId: 'abc' } };
		addLogContext(locals, { detail: 'test' });
		expect(locals.logContext).toEqual({ mealId: 'abc', detail: 'test' });
	});

	it('overwrites existing keys with new values', () => {
		const locals: App.Locals = { logContext: { detail: 'old' } };
		addLogContext(locals, { detail: 'new' });
		expect(locals.logContext).toEqual({ detail: 'new' });
	});
});
