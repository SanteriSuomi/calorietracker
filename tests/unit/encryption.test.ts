import { describe, expect, it } from 'vitest';

process.env.ENCRYPTION_SECRET = 'test-encryption-secret-for-unit-tests-32ch';

import { decrypt, deriveUserKey, encrypt } from '$lib/server/encryption';

describe('deriveUserKey', () => {
	it('returns 32-byte Buffer', () => {
		const key = deriveUserKey('user-1');
		expect(key).toBeInstanceOf(Buffer);
		expect(key.length).toBe(32);
	});

	it('same inputs produce same key', () => {
		const a = deriveUserKey('user-1');
		const b = deriveUserKey('user-1');
		expect(a.equals(b)).toBe(true);
	});

	it('different userIds produce different keys', () => {
		const a = deriveUserKey('user-1');
		const b = deriveUserKey('user-2');
		expect(a.equals(b)).toBe(false);
	});
});

describe('encrypt + decrypt roundtrip', () => {
	const key = deriveUserKey('test-user');

	it('encrypts then decrypts returns original data', () => {
		const original = Buffer.from('hello world');
		const encrypted = encrypt(original, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted.equals(original)).toBe(true);
	});

	it('works with empty buffer', () => {
		const original = Buffer.alloc(0);
		const encrypted = encrypt(original, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted.equals(original)).toBe(true);
	});

	it('works with large buffer (1MB)', () => {
		const original = Buffer.alloc(1024 * 1024, 0xab);
		const encrypted = encrypt(original, key);
		const decrypted = decrypt(encrypted, key);
		expect(decrypted.equals(original)).toBe(true);
	});

	it('encrypted output is different from input', () => {
		const original = Buffer.from('hello world');
		const encrypted = encrypt(original, key);
		expect(encrypted.equals(original)).toBe(false);
	});

	it('each encryption produces different output (random IV)', () => {
		const original = Buffer.from('hello world');
		const a = encrypt(original, key);
		const b = encrypt(original, key);
		expect(a.equals(b)).toBe(false);
	});
});

describe('decrypt tamper detection', () => {
	const key = deriveUserKey('test-user');

	it('throws on tampered ciphertext', () => {
		const original = Buffer.from('hello world');
		const encrypted = encrypt(original, key);
		const tampered = Buffer.from(encrypted);
		tampered[tampered.length - 1] ^= 0xff;
		expect(() => decrypt(tampered, key)).toThrow();
	});

	it('throws on tampered IV', () => {
		const original = Buffer.from('hello world');
		const encrypted = encrypt(original, key);
		const tampered = Buffer.from(encrypted);
		tampered[0] ^= 0xff;
		expect(() => decrypt(tampered, key)).toThrow();
	});

	it('throws on wrong key', () => {
		const original = Buffer.from('hello world');
		const encrypted = encrypt(original, key);
		const wrongKey = deriveUserKey('other-user');
		expect(() => decrypt(encrypted, wrongKey)).toThrow();
	});
});
