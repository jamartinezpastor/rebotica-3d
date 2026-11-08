import { describe, expect, it, vi } from 'vitest';
import { crearClienteCima } from '../src/cliente';
import { Detalle } from '../src/esquemas';
import { obtenerInformacionCima } from '../src/seguridad';

const detalle = (extra: object = {}) =>
  Detalle.parse({
    nregistro: '1001',
    nombre: 'Medicamento ficticio',
    receta: false,
    comerc: true,
    notas: true,
    psum: true,
    presentaciones: [{ cn: '100101', nombre: 'Envase ficticio', comerc: true, psum: true }],
    ...extra,
  });
const incidencia = {
  cn: '100101',
  nombre: 'Envase ficticio',
  activo: true,
  fini: 1767268800000,
  observ: '<p>Observación ficticia.</p>',
};
const nota = {
  tipo: 1,
  referencia: 'FICTICIA',
  asunto: 'Aviso ficticio',
  fecha: 1767268800000,
  url: 'https://www.aemps.gob.es/nota-ficticia',
};

function clienteCon(responder: (url: URL) => Response) {
  const fetch = vi.fn(async (entrada: URL | string | Request) =>
    responder(new URL(String(entrada))),
  );
  return { fetch, cliente: crearClienteCima({ fetch, intervaloMs: 0, maxReintentos: 0 }) };
}
const pagina = (resultados: unknown[]) =>
  Response.json({ pagina: 1, tamanioPagina: 200, totalFilas: resultados.length, resultados });

describe('copia local de suministro y notas', () => {
  it('guarda incidencias activas con fechas opcionales y notas de seguridad', async () => {
    const { cliente } = clienteCon((url) =>
      url.pathname.includes('psuministro')
        ? pagina([incidencia, { ...incidencia, activo: false }])
        : Response.json([nota]),
    );
    const error = vi.fn();
    const informacion = await obtenerInformacionCima(cliente, detalle(), error);
    expect(error).not.toHaveBeenCalled();
    expect(informacion.suministro?.incidencias).toEqual([
      {
        cn: '100101',
        nombre: 'Envase ficticio',
        inicio: '2026-01-01T12:00:00.000Z',
        finPrevisto: null,
        observaciones: 'Observación ficticia.',
      },
    ]);
    expect(informacion.seguridad?.notas[0]).toMatchObject({
      referencia: 'FICTICIA',
      asunto: 'Aviso ficticio',
    });
  });

  it('recorre todas las páginas de incidencias', async () => {
    const { cliente, fetch } = clienteCon((url) => {
      if (url.pathname.endsWith('/notas')) return Response.json([nota]);
      const pagina = Number(url.searchParams.get('pagina'));
      return Response.json({
        pagina,
        tamanioPagina: 1,
        totalFilas: 2,
        resultados: [{ ...incidencia, observ: `Observación ${pagina}` }],
      });
    });
    const informacion = await obtenerInformacionCima(cliente, detalle(), vi.fn());
    expect(informacion.suministro?.incidencias).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('un fallo del suministro no borra las notas ni se presenta como ausencia de incidencias', async () => {
    const { cliente } = clienteCon((url) =>
      url.pathname.includes('psuministro')
        ? new Response(null, { status: 503 })
        : Response.json([nota]),
    );
    const error = vi.fn();
    const informacion = await obtenerInformacionCima(cliente, detalle(), error);
    expect(informacion.suministro).toBeNull();
    expect(informacion.seguridad?.notas).toHaveLength(1);
    expect(error).toHaveBeenCalledOnce();
  });

  it.each(
    [
      [],
      [{ ...incidencia, cn: '999999' }],
      [{ ...incidencia, activo: false }],
      [{ ...incidencia, fini: 'ayer' }],
    ].map((resultados) => ({ resultados })),
  )(
    'no publica una respuesta incoherente con la presentación afectada: %s',
    async ({ resultados }) => {
      const { cliente } = clienteCon((url) =>
        url.pathname.includes('psuministro') ? pagina(resultados) : Response.json([nota]),
      );
      const informacion = await obtenerInformacionCima(cliente, detalle(), vi.fn());
      expect(informacion.suministro).toBeNull();
    },
  );

  it('distingue una consulta sin avisos de una respuesta ausente', async () => {
    const { cliente, fetch } = clienteCon(() => new Response(null, { status: 404 }));
    const sinAvisos = await obtenerInformacionCima(
      cliente,
      detalle({ notas: false, psum: false, presentaciones: [] }),
      vi.fn(),
    );
    expect(sinAvisos.suministro?.incidencias).toEqual([]);
    expect(sinAvisos.seguridad?.notas).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    const sinRespuesta = await obtenerInformacionCima(cliente, detalle(), vi.fn());
    expect(sinRespuesta).toEqual({ suministro: null, seguridad: null });
  });

  it('un indicador de notas ausente no se interpreta como ausencia de notas', async () => {
    const { cliente } = clienteCon(() => Response.json([]));
    const informacion = await obtenerInformacionCima(
      cliente,
      detalle({ notas: undefined, psum: false, presentaciones: [] }),
      vi.fn(),
    );
    expect(informacion.seguridad).toBeNull();
  });
});
