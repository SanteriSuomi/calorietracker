import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { provider } from './shared/provider';
import type * as schema from './sqlite/schema';

export type { DatabaseProvider } from './shared/provider';
export { provider as databaseProvider };

type Db = LibSQLDatabase<typeof schema>;

const { db: rawDb } = await (provider === 'pg' ? import('./pg/driver') : import('./sqlite/driver'));

export const db = rawDb as Db;
