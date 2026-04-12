import { provider } from './shared/provider';

export type { DatabaseProvider } from './shared/provider';
export { provider as databaseProvider };

export const { db } = await (provider === 'pg' ? import('./pg/driver') : import('./sqlite/driver'));
