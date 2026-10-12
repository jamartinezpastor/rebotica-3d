import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema';

/** Abre un pool de PostgreSQL con el esquema tipado. */
export function conectar(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool, { schema }), pool };
}

export type Db = ReturnType<typeof conectar>['db'];

/** Aplica las migraciones pendientes; `carpeta` es la ruta de `packages/db/migrations`. */
export async function aplicarMigraciones(db: Db, carpeta: string): Promise<void> {
  await migrate(db, { migrationsFolder: carpeta });
}
