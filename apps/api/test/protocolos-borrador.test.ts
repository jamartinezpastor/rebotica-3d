import { readdir, readFile } from 'node:fs/promises';
import { CONSULTAS_FRECUENTES } from '@rebotica/shared';
import { Protocolo, evaluarTriaje, protocoloEvaluable } from '@rebotica/protocolos';
import { describe, expect, it } from 'vitest';

const directorio = new URL('../../../packages/protocolos/data/', import.meta.url);

describe('F4-04: borradores de los protocolos del MVP', () => {
  it('cubre exactamente las consultas del catálogo cerrado, sin archivos adicionales', async () => {
    const archivos = (await readdir(directorio)).filter((a) => a.endsWith('.json')).sort();
    expect(archivos).toEqual(CONSULTAS_FRECUENTES.map((c) => `${c.id}.json`).sort());
  });

  it.each(CONSULTAS_FRECUENTES)(
    '$id: trazable, coherente y bloqueado para uso clínico',
    async ({ id }) => {
      const p = Protocolo.parse(
        JSON.parse(await readFile(new URL(`${id}.json`, directorio), 'utf8')),
      );
      expect(p.id).toBe(id);
      expect(p.estado).toBe('borrador');
      expect(p.validadoPor).toBeNull();
      expect(p.validadoEn).toBeNull();
      expect(p.revision?.fuentes.length).toBeGreaterThan(0);
      expect(p.revision?.pendienteDe.length).toBeGreaterThan(0);
      expect(p.revision?.alcance).toBeTruthy();
      expect(protocoloEvaluable(p)).toBe(false);
      expect(evaluarTriaje(p, {})).toEqual({ tipo: 'no-disponible', motivo: 'protocolo' });
      // Añadir una firma sin resolver la revisión tampoco convierte el borrador en publicable.
      expect(
        Protocolo.safeParse({
          ...p,
          estado: 'validado',
          validadoPor: 'Firma ficticia de prueba',
          validadoEn: '2020-01-01',
        }).success,
      ).toBe(false);
      expect(p.criteriosDerivacion.every((c) => c.cuando)).toBe(true);
      expect(p.preguntasTriaje.some((q) => q.tipo === 'grupo')).toBe(true);
      expect(p.preguntasTriaje.some((q) => q.tipo === 'edad')).toBe(true);
      expect(p.preguntasTriaje.some((q) => q.tipo === 'duracion')).toBe(true);
      expect(new Set(p.baldas.map((b) => b.orden)).size).toBe(p.baldas.length);
      for (const b of p.baldas) {
        for (const condicion of b.condicionesExcluidas) {
          expect(p.preguntasTriaje.find((q) => q.id === condicion)?.tipo).toBe('siNo');
        }
      }
    },
  );
});
