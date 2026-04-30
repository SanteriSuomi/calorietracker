import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decrypt, deriveUserKey, encrypt } from '../encryption';
import type { StorageProvider } from './index';

const BASE_DIR = 'data/images';

export default class LocalStorage implements StorageProvider {
	async save(userId: string, filename: string, data: Buffer): Promise<void> {
		const dir = join(BASE_DIR, userId);
		if (!existsSync(dir)) await mkdir(dir, { recursive: true });
		const key = deriveUserKey(userId);
		const encrypted = encrypt(data, key);
		await writeFile(join(dir, `${filename}.enc`), encrypted);
	}

	async read(userId: string, filename: string): Promise<Buffer> {
		const path = join(BASE_DIR, userId, `${filename}.enc`);
		const encrypted = await readFile(path);
		const key = deriveUserKey(userId);
		return decrypt(encrypted, key);
	}

	async remove(userId: string, filename: string): Promise<void> {
		const path = join(BASE_DIR, userId, `${filename}.enc`);
		if (existsSync(path)) await unlink(path);
	}
}
