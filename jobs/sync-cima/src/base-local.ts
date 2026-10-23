import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { z } from 'zod';

function codigo(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}

/** Un solo proceso puede abrir el catálogo en disco; un PID huérfano permite reanudarlo. */
async function bloquear(directorio: string) {
  const ruta = join(directorio, 'servidor.pid');
  for (let intento = 0; intento < 2; intento++) {
    try {
      const archivo = await open(ruta, 'wx');
      try {
        await archivo.writeFile(String(process.pid));
      } finally {
        await archivo.close();
      }
      return async () => {
        await unlink(ruta).catch((error: unknown) => {
          if (codigo(error) !== 'ENOENT') throw error;
        });
      };
    } catch (error) {
      if (codigo(error) !== 'EEXIST') throw error;
      const pid = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(await readFile(ruta, 'utf8'));
      if (!pid.success) throw new Error(`Bloqueo de catálogo inválido: ${ruta}`, { cause: error });
      try {
        process.kill(pid.data, 0);
      } catch (error) {
        if (codigo(error) === 'ESRCH') {
          await unlink(ruta);
          continue;
        }
        if (codigo(error) !== 'EPERM') throw error;
      }
      throw new Error('El catálogo local ya está abierto por otro proceso', { cause: error });
    }
  }
  throw new Error('No se pudo abrir el catálogo local');
}

export async function abrirBaseLocal(directorio: string) {
  const raiz = resolve(directorio);
  await mkdir(raiz, { recursive: true });
  const liberar = await bloquear(raiz);
  const pg = new PGlite(join(raiz, 'postgres'));
  let cerrada: Promise<void> | undefined;
  const cerrar = () => {
    cerrada ??= pg.close().finally(liberar);
    return cerrada;
  };
  const db = drizzle(pg);
  try {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
    });
  } catch (error) {
    await cerrar();
    throw error;
  }
  return { db, cerrar };
}
