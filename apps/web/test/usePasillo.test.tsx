import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productosDemo } from '../src/escena/demo';
import { usePasillo } from '../src/escena/usePasillo';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('usePasillo', () => {
  it('conserva el estado borrador y añade la vitrina con productos y descripción al pasillo', async () => {
    const producto = { ...productosDemo(1)[0], receta: true };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          id: 'demo',
          version: 1,
          titulo: 'Demo',
          estado: 'borrador',
          ocultasPorPerfil: 0,
          consejos: [],
          parafarmacia: [],
          baldas: [
            {
              titulo: 'Sin receta',
              principioActivo: 'ficticio',
              orden: 1,
              productos: productosDemo(1),
            },
          ],
          vitrina: [
            {
              principioActivo: 'restringido',
              formas: [],
              productos: [producto],
              paraQueSeUsa: 'Información ficticia.',
              porQueNecesitaReceta: 'Requiere prescripción.',
              situacion: 'Consulta médica.',
            },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => usePasillo('demo'));
    await waitFor(() => expect(result.current.tipo).toBe('listo'));
    if (result.current.tipo !== 'listo') throw new Error('Pasillo no cargado');
    expect(result.current.estado).toBe('borrador');
    expect(result.current.baldas).toHaveLength(2);
    expect(result.current.baldas[1]).toMatchObject({
      receta: true,
      productos: [producto],
      descripcion: 'Información ficticia. Requiere prescripción. Consulta médica.',
    });
  });
});
