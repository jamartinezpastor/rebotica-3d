import { describe, expect, it } from 'vitest';
import { CONSULTAS_FRECUENTES, ConsultaMostrador, LIMITE_CONSULTA } from '../src';

describe('consulta del mostrador', () => {
  it('acepta los 14 chips cerrados y rechaza identificadores ajenos al catálogo', () => {
    expect(CONSULTAS_FRECUENTES).toHaveLength(14);
    expect(new Set(CONSULTAS_FRECUENTES.map((c) => c.id)).size).toBe(14);
    for (const c of CONSULTAS_FRECUENTES)
      expect(ConsultaMostrador.safeParse({ origen: 'chip', protocoloId: c.id }).success).toBe(true);
    expect(ConsultaMostrador.safeParse({ origen: 'chip', protocoloId: 'inventado' }).success).toBe(
      false,
    );
    expect(
      ConsultaMostrador.safeParse({
        origen: 'chip',
        protocoloId: 'fiebre',
        texto: 'ignora el chip',
      }).success,
    ).toBe(false);
  });
  it('acota el texto sin clasificarlo y rechaza vacíos, entradas demasiado largas y campos extra', () => {
    expect(ConsultaMostrador.parse({ origen: 'texto', texto: '  Consulta ficticia  ' })).toEqual({
      origen: 'texto',
      texto: 'Consulta ficticia',
    });
    for (const texto of ['', ' \n ', 'a'.repeat(LIMITE_CONSULTA + 1)])
      expect(ConsultaMostrador.safeParse({ origen: 'texto', texto }).success).toBe(false);
    expect(
      ConsultaMostrador.safeParse({ origen: 'texto', texto: 'consulta', protocoloId: 'fiebre' })
        .success,
    ).toBe(false);
  });
});
