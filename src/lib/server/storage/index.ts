import { env } from '$env/dynamic/private';

export type StorageProviderType = 'local' | 'azure';

export interface StorageProvider {
	save(userId: string, filename: string, data: Buffer): Promise<void>;
	read(userId: string, filename: string): Promise<Buffer>;
	remove(userId: string, filename: string): Promise<void>;
}

const provider = (env.STORAGE_PROVIDER as StorageProviderType) ?? 'local';

const mod = await (provider === 'azure' ? import('./azure') : import('./local'));

export const storage: StorageProvider = new mod.default();
