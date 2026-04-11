import { provider } from './shared/provider';

export { provider as databaseProvider };

export type { DatabaseProvider } from './shared/provider';

export const { db } = await (provider === 'pg' ? import('./pg/driver') : import('./sqlite/driver'));
