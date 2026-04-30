import { BlobServiceClient } from '@azure/storage-blob';
import { env } from '$env/dynamic/private';
import type { StorageProvider } from './index';

const CONTAINER_NAME = 'calorietracker-images';

function getClient(): BlobServiceClient {
	const connStr = env.AZURE_BLOB_CONNECTION_STRING;
	if (!connStr) throw new Error('AZURE_BLOB_CONNECTION_STRING env var is not set');
	return BlobServiceClient.fromConnectionString(connStr);
}

export default class AzureStorage implements StorageProvider {
	async save(userId: string, filename: string, data: Buffer): Promise<void> {
		const client = getClient();
		const container = client.getContainerClient(CONTAINER_NAME);
		await container.createIfNotExists();
		const blob = container.getBlockBlobClient(`${userId}/${filename}`);
		await blob.uploadData(data);
	}

	async read(userId: string, filename: string): Promise<Buffer> {
		const client = getClient();
		const container = client.getContainerClient(CONTAINER_NAME);
		const blob = container.getBlockBlobClient(`${userId}/${filename}`);
		const response = await blob.download();
		const chunks: Buffer[] = [];
		for await (const chunk of response.readableStreamBody as AsyncIterable<Buffer>) {
			chunks.push(chunk);
		}
		return Buffer.concat(chunks);
	}

	async remove(userId: string, filename: string): Promise<void> {
		const client = getClient();
		const container = client.getContainerClient(CONTAINER_NAME);
		const blob = container.getBlockBlobClient(`${userId}/${filename}`);
		await blob.deleteIfExists();
	}
}
