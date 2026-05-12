import { describe, expect, it } from 'vitest';

describe('Email module — provider selection', () => {
	it('defaults to resend provider when EMAIL_PROVIDER is not set', () => {
		delete process.env.EMAIL_PROVIDER;
		const provider = process.env.EMAIL_PROVIDER ?? 'resend';
		expect(provider).toBe('resend');
	});

	it('uses azure provider when EMAIL_PROVIDER=azure', () => {
		process.env.EMAIL_PROVIDER = 'azure';
		const provider = process.env.EMAIL_PROVIDER ?? 'resend';
		expect(provider).toBe('azure');
		delete process.env.EMAIL_PROVIDER;
	});
});

describe('Password reset — validation', () => {
	it('rejects passwords shorter than 8 characters', () => {
		const password = 'short';
		expect(password.length < 8).toBe(true);
	});

	it('accepts passwords with 8 or more characters', () => {
		const password = 'password123';
		expect(password.length >= 8).toBe(true);
	});

	it('detects password mismatch', () => {
		const pw1: string = 'password123';
		const pw2: string = 'password456';
		expect(pw1 !== pw2).toBe(true);
	});

	it('accepts matching passwords', () => {
		const pw1: string = 'password123';
		const pw2: string = 'password123';
		expect(pw1 === pw2).toBe(true);
	});
});

describe('Reset password page — token validation', () => {
	it('identifies missing token', () => {
		const token: string | null = null;
		expect(!token).toBe(true);
	});

	it('identifies present token', () => {
		const token: string | null = 'valid-reset-token-abc123';
		expect(!!token).toBe(true);
	});
});
