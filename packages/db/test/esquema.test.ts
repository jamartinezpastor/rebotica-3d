import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { medicamento, reglaDosis } from '../src';

const cliente = new PGlite();
const db = drizzle(cliente);

const base = {
  nombre: 'MEDICAMENTO DE PRUEBA',
  pactivos: 'principio ficticio',
  comerc: true,
};

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
  await db.insert(medicamento).values([
    { ...base, nregistro: 'SIN-RECETA', receta: false },
    { ...base, nregistro: 'CON-RECETA', receta: true },
  ]);
});

afterAll(() => cliente.close());

describe('esquema de la base de datos', () => {
  it('acepta una regla de dosis para un medicamento sin receta', async () => {
    await db.insert(reglaDosis).values({
      nregistro: 'SIN-RECETA',
      version: 1,
      json: {},
      hashSeccion: 'h',
    });
  });

  it('rechaza una regla de dosis para un medicamento con receta', async () => {
    await expect(
      db.insert(reglaDosis).values({
        nregistro: 'CON-RECETA',
        version: 1,
        json: {},
        hashSeccion: 'h',
      }),
    ).rejects.toThrow();
  });

  it('rechaza una regla que declare receta=false apuntando a un medicamento con receta', async () => {
    await expect(
      db.insert(reglaDosis).values({
        nregistro: 'CON-RECETA',
        receta: false,
        version: 2,
        json: {},
        hashSeccion: 'h',
      }),
    ).rejects.toThrow();
  });

  it('rechaza una foto en un medicamento con receta', async () => {
    await expect(
      db.insert(medicamento).values({
        ...base,
        nregistro: 'CON-FOTO',
        receta: true,
        fotoUrl: 'https://example.invalid/foto.jpg',
      }),
    ).rejects.toThrow();
  });
});
