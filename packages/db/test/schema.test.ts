import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const carpeta = join(import.meta.dirname, '..', 'drizzle');

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const archivos = readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of archivos) {
    for (const sentencia of readFileSync(join(carpeta, f), 'utf8').split(
      '--> statement-breakpoint',
    )) {
      await db.exec(sentencia);
    }
  }
  await db.exec(`
    INSERT INTO medicamento (nregistro, nombre, pactivos, receta, comerc) VALUES
      ('100', 'FICTICIO LIBRE', 'principio-a', false, true),
      ('200', 'FICTICIO CON RECETA', 'principio-b', true, true);
  `);
});

const regla = (nregistro: string, receta: boolean) =>
  db.query(
    `INSERT INTO regla_dosis (nregistro, receta, version, json, hash_seccion, estado)
     VALUES ($1, $2, 1, '{}', 'h', 'borrador')`,
    [nregistro, receta],
  );

describe('regla_dosis', () => {
  it('admite una regla de un medicamento sin receta', async () => {
    await expect(regla('100', false)).resolves.toBeDefined();
  });

  it('rechaza una regla marcada con receta', async () => {
    await expect(regla('200', true)).rejects.toThrow(/regla_dosis_sin_receta/);
  });

  it('rechaza una regla de un medicamento con receta declarándola sin receta', async () => {
    await expect(regla('200', false)).rejects.toThrow(/regla_dosis_medicamento_fk/);
  });

  it('rechaza un medicamento que pasa a receta mientras tenga reglas', async () => {
    await expect(
      db.query(`UPDATE medicamento SET receta = true WHERE nregistro = '100'`),
    ).rejects.toThrow();
  });
});

describe('protocolo', () => {
  it('un protocolo validado exige firma y fecha', async () => {
    await expect(
      db.query(
        `INSERT INTO protocolo (id, version, json, estado) VALUES ('x', 1, '{}', 'validado')`,
      ),
    ).rejects.toThrow(/protocolo_validado_firmado/);
  });
});
