import { env } from '$env/dynamic/private';

export type DatabaseProvider = 'libsql' | 'pg';

export const provider: DatabaseProvider = (env.DATABASE_PROVIDER as DatabaseProvider) ?? 'libsql';
