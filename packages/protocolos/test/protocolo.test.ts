import { describe, expect, it } from 'vitest';
import { Protocolo } from '../src/index';

/** Protocolo FICTICIO solo para probar el esquema; no es contenido clínico. */
const protocoloFicticio = {
  id: 'sintoma-ficticio',
  version: 1,
  titulo: 'Síntoma ficticio',
  sinonimos: ['molestia de prueba'],
  preguntasTriaje: [{ id: 'para-quien', texto: '¿Para quién es?', tipo: 'grupo' }],
  criteriosDerivacion: [
    {
      id: 'alarma-prueba',
      descripcion: 'Criterio de prueba',
      urgencia: 'medico',
      palabrasClave: ['palabra de prueba'],
    },
  ],
  baldas: [
    {
      titulo: 'Balda de prueba',
      principioActivo: 'principio ficticio',
      orden: 1,
      gruposExcluidos: ['bebe'],
      condicionesExcluidas: [],
    },
  ],
  vitrina: [
    {
      principioActivo: 'principio con receta ficticio',
      paraQueSeUsa: 'Texto de prueba',
      porQueNecesitaReceta: 'Texto de prueba',
      situacion: 'Texto de prueba',
    },
  ],
  consejos: ['Consejo de prueba'],
  parafarmacia: [],
  estado: 'borrador',
  validadoPor: null,
  validadoEn: null,
} as const;

describe('Protocolo', () => {
  it('acepta un borrador bien formado', () => {
    expect(Protocolo.safeParse(protocoloFicticio).success).toBe(true);
  });

  it('la vitrina con receta no admite marca, foto ni dosis', () => {
    for (const extra of [{ marca: 'X' }, { foto: 'x.png' }, { dosis: '1 comprimido' }]) {
      const conExtra = {
        ...protocoloFicticio,
        vitrina: [{ ...protocoloFicticio.vitrina[0], ...extra }],
      };
      expect(Protocolo.safeParse(conExtra).success).toBe(false);
    }
  });

  it('un protocolo validado exige firma y fecha', () => {
    expect(Protocolo.safeParse({ ...protocoloFicticio, estado: 'validado' }).success).toBe(false);
  });

  it('exige al menos un criterio de derivación', () => {
    expect(Protocolo.safeParse({ ...protocoloFicticio, criteriosDerivacion: [] }).success).toBe(
      false,
    );
  });
});
