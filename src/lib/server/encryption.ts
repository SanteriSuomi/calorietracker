import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionSecret(): string {
	const secret = env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET;
	if (!secret) throw new Error('ENCRYPTION_SECRET env var is not set');
	return secret;
}

export function deriveUserKey(userId: string): Buffer {
	return scryptSync(userId, getEncryptionSecret(), 32);
}

export function encrypt(data: Buffer, key: Buffer): Buffer {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(data: Buffer, key: Buffer): Buffer {
	const iv = data.subarray(0, IV_LENGTH);
	const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
	const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
