import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { medicamento, syncEstado } from '@rebotica/db';
import { expect, it } from 'vitest';
import { abrirBaseLocal } from '../src/base-local';

async function borrarTemporal(directorio: string) {
  const ruta = resolve(directorio);
  if (dirname(ruta) !== resolve(tmpdir()) || !basename(ruta).startsWith('rebotica-local-test-'))
    throw new Error('Ruta temporal de prueba no válida');
  await rm(ruta, { recursive: true, force: true });
}

it('conserva catálogo y progreso al reiniciar e impide abrir la base en dos procesos', async () => {
  const directorio = await mkdtemp(join(tmpdir(), 'rebotica-local-test-'));
  let base: Awaited<ReturnType<typeof abrirBaseLocal>> | undefined;
  try {
    base = await abrirBaseLocal(directorio);
    await base.db.insert(medicamento).values({
      nregistro: 'LOCAL-FICTICIO',
      nombre: 'Producto ficticio',
      pactivos: 'Activo ficticio',
      receta: false,
      comerc: true,
    });
    await base.db.insert(syncEstado).values({
      clave: 'cima.carga_completa_desde',
      valor: '2026-10-23T00:00:00.000Z',
    });
    await expect(abrirBaseLocal(directorio)).rejects.toThrow('ya está abierto');
    await base.cerrar();
    base = await abrirBaseLocal(directorio);
    expect((await base.db.select().from(medicamento)).map((m) => m.nregistro)).toEqual([
      'LOCAL-FICTICIO',
    ]);
    expect(await base.db.select().from(syncEstado)).toEqual([
      expect.objectContaining({
        clave: 'cima.carga_completa_desde',
        valor: '2026-10-23T00:00:00.000Z',
      }),
    ]);
  } finally {
    await base?.cerrar();
    await borrarTemporal(directorio);
  }
}, 20_000);
