import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ReglaDosis, calcularDosis, puedeMostrarCalculadora } from '@rebotica/dosis';

describe('F3-04: semillas de curación', () => {
  it('contiene exactamente cinco borradores sin firma y ninguno permite calcular', async () => {
    const directorio = new URL('../../../packages/dosis/data/reglas/', import.meta.url);
    const archivos = (await readdir(directorio)).filter((a) => a.endsWith('.json'));
    expect(archivos).toHaveLength(5);
    const registros = new Set<string>();
    for (const archivo of archivos) {
      const regla = ReglaDosis.parse(
        JSON.parse(await readFile(new URL(archivo, directorio), 'utf8')),
      );
      expect(archivo).toBe(`${regla.id}.json`);
      expect(regla.estado).toBe('borrador');
      expect(regla.fuente.validadoPor).toBeNull();
      expect(regla.fuente.fecha).toBeNull();
      expect(regla.fuente.hashSeccion).toMatch(/^[a-f0-9]{64}$/);
      expect(regla.fuente.cita).toBeTruthy();
      expect(puedeMostrarCalculadora(regla)).toBe(false);
      expect(calcularDosis(regla, {})).toEqual({ tipo: 'noDisponible', motivo: 'sinValidar' });
      registros.add(regla.fuente.nregistro);
    }
    expect(registros.size).toBe(5);
  });
});
