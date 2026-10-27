import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  CONSULTAS_FRECUENTES,
  ErrorTriaje,
  ExplorarRespuesta,
  InterpretarRespuesta,
  InterpretarCatalogoRespuesta,
  ProtocoloTriajeRespuesta,
  TriajeRespuesta,
  type ConsultaMostrador,
  type DerivacionConsulta,
  type DerivacionTriaje,
  type PasilloResponse,
  type RespuestasTriaje,
  type EstadoCatalogoPublico,
} from '@rebotica/shared';
import { Mostrador } from './Mostrador';
import { Derivacion } from './Derivacion';
import { Pregunta } from './Pregunta';
import { EstadoCatalogo } from '../escena/EstadoCatalogo';

type Protocolo = ProtocoloTriajeRespuesta;
type Estado =
  | { tipo: 'entrada' }
  | { tipo: 'cargando' }
  | { tipo: 'aclaracion'; alternativas: string[] }
  | {
      tipo: 'preguntas';
      protocolo: Protocolo;
      respuestas: RespuestasTriaje;
      pendientes: string[];
      ocupada: boolean;
    }
  | { tipo: 'derivacion'; resultado: DerivacionConsulta | DerivacionTriaje }
  | { tipo: 'listo'; pasillo: PasilloResponse }
  | { tipo: 'vacio'; catalogo?: EstadoCatalogoPublico }
  | { tipo: 'error'; motivo: MotivoError };

type MotivoError =
  | 'cambiado'
  | 'catalogo'
  | 'sincronizacion'
  | 'indicaciones'
  | 'protocolo'
  | 'interpretacion'
  | 'conexion'
  | 'servicio';
class ErrorConsulta extends Error {
  constructor(readonly motivo: MotivoError) {
    super(motivo);
  }
}
const MENSAJES_ERROR: Record<MotivoError, { titulo: string; texto: string }> = {
  indicaciones: {
    titulo: 'Esta copia no permite buscar por dolencia',
    texto:
      'No hay indicaciones consultables en esta copia. Puedes explorar el catálogo general y abrir los prospectos oficiales.',
  },
  cambiado: {
    titulo: 'Las preguntas de esta consulta han cambiado',
    texto: 'Empieza una nueva consulta para usar la versión actual.',
  },
  catalogo: {
    titulo: 'El catálogo de consulta aún no está disponible',
    texto:
      'Todavía no podemos mostrar medicamentos a partir de tu consulta. Puedes explorar la demostración con productos ficticios.',
  },
  sincronizacion: {
    titulo: 'El catálogo de medicamentos se está preparando',
    texto: 'Todavía no hay indicaciones disponibles para buscar. Vuelve a intentarlo más tarde.',
  },
  protocolo: {
    titulo: 'Esta consulta está pendiente de revisión farmacéutica',
    texto:
      'Sus preguntas y asociaciones con medicamentos aún no están validadas. Puedes explorar la demostración con productos ficticios.',
  },
  interpretacion: {
    titulo: 'No hemos podido interpretar el texto ahora',
    texto:
      'Puedes empezar de nuevo y elegir una consulta frecuente o volver a intentarlo más tarde.',
  },
  conexion: {
    titulo: 'No hemos podido conectar con el servidor',
    texto: 'Comprueba la conexión y vuelve a intentarlo. La consulta no se ha completado.',
  },
  servicio: {
    titulo: 'No podemos completar esta consulta ahora',
    texto:
      'El servicio no está disponible o no ha devuelto una respuesta válida. Vuelve a intentarlo más tarde.',
  },
};

async function solicitar(url: string, control: AbortController, body?: unknown) {
  const r = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    signal: control.signal,
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    ...(body === undefined
      ? {}
      : {
          headers: {
            'content-type': 'application/json',
            ...(url === '/api/explorar' ? { 'x-rebotica-catalogo': '1' } : {}),
          },
          body: JSON.stringify(body),
        }),
  }).catch(() => {
    throw new ErrorConsulta('conexion');
  });
  if (!r.ok) {
    if (r.status === 409) throw new ErrorConsulta('cambiado');
    if (
      url.startsWith('/api/protocolos/') ||
      url === '/api/triaje' ||
      url === '/api/explorar' ||
      url === '/api/interpretar'
    ) {
      const fallo = ErrorTriaje.safeParse(await r.json().catch(() => null));
      if (fallo.success && fallo.data.codigo === 'CATALOGO_NO_CONFIGURADO')
        throw new ErrorConsulta('catalogo');
      if (fallo.success && fallo.data.codigo === 'CATALOGO_NO_SINCRONIZADO')
        throw new ErrorConsulta('sincronizacion');
      if (fallo.success && fallo.data.codigo === 'CATALOGO_SIN_INDICACIONES')
        throw new ErrorConsulta('indicaciones');
      if (fallo.success && fallo.data.codigo === 'PROTOCOLO_NO_VALIDADO')
        throw new ErrorConsulta('protocolo');
    }
    throw new ErrorConsulta(url === '/api/interpretar' ? 'interpretacion' : 'servicio');
  }
  return r.json() as Promise<unknown>;
}

export function ConsultaGuiada({
  onActiva,
  onPasillo,
  modo = 'triaje',
}: {
  onActiva: (activa: boolean) => void;
  onPasillo: (pasillo: PasilloResponse) => void;
  modo?: 'triaje' | 'informativo';
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'entrada' });
  const pendiente = useRef<AbortController | null>(null);
  const cabecera = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const borrar = () => {
      pendiente.current?.abort();
      pendiente.current = null;
      flushSync(() => {
        setEstado({ tipo: 'entrada' });
        onActiva(false);
      });
    };
    window.addEventListener('pagehide', borrar);
    const restaurar = (e: PageTransitionEvent) => {
      if (e.persisted) borrar();
    };
    window.addEventListener('pageshow', restaurar);
    return () => {
      pendiente.current?.abort();
      window.removeEventListener('pagehide', borrar);
      window.removeEventListener('pageshow', restaurar);
    };
  }, [onActiva]);
  useEffect(() => {
    if (estado.tipo !== 'entrada' && estado.tipo !== 'preguntas' && estado.tipo !== 'derivacion')
      cabecera.current?.focus();
  }, [estado.tipo]);

  const nueva = () => {
    pendiente.current?.abort();
    pendiente.current = null;
    setEstado({ tipo: 'entrada' });
    onActiva(false);
  };
  const ejecutar = async (accion: (c: AbortController) => Promise<void>) => {
    if (pendiente.current) return;
    const c = new AbortController();
    pendiente.current = c;
    const temporizador = setTimeout(() => {
      c.abort();
      if (pendiente.current === c) {
        pendiente.current = null;
        setEstado({ tipo: 'error', motivo: 'conexion' });
      }
    }, 30000);
    const limpiarPlazo = () => clearTimeout(temporizador);
    c.signal.addEventListener('abort', limpiarPlazo, { once: true });
    try {
      await accion(c);
    } catch (e) {
      if (!c.signal.aborted)
        setEstado({ tipo: 'error', motivo: e instanceof ErrorConsulta ? e.motivo : 'servicio' });
    } finally {
      limpiarPlazo();
      c.signal.removeEventListener('abort', limpiarPlazo);
      if (pendiente.current === c) pendiente.current = null;
    }
  };
  const cargar = async (id: string, c: AbortController) => {
    if (modo === 'informativo') {
      const pasillo = ExplorarRespuesta.parse(
        await solicitar('/api/explorar', c, { consultaId: id }),
      );
      if (pasillo.id !== id) throw new Error('contrato');
      if (c.signal.aborted) return;
      if (![...pasillo.baldas, ...pasillo.vitrina].some((g) => g.productos.length))
        setEstado({ tipo: 'vacio', catalogo: pasillo.catalogo });
      else onPasillo(pasillo);
      return;
    }
    const p = ProtocoloTriajeRespuesta.parse(
      await solicitar(`/api/protocolos/${encodeURIComponent(id)}`, c),
    );
    if (p.id !== id || new Set(p.preguntas.map((q) => q.id)).size !== p.preguntas.length)
      throw new Error('contrato');
    if (!c.signal.aborted)
      setEstado({
        tipo: 'preguntas',
        protocolo: p,
        respuestas: {},
        pendientes: p.preguntas.map((q) => q.id),
        ocupada: false,
      });
  };
  const elegirProtocolo = (id: string) => {
    if (pendiente.current) return;
    setEstado({ tipo: 'cargando' });
    void ejecutar((c) => cargar(id, c));
  };
  const continuar = (consulta: ConsultaMostrador) => {
    if (pendiente.current) return;
    onActiva(true);
    setEstado({ tipo: 'cargando' });
    void ejecutar(async (c) => {
      if (consulta.origen === 'chip') {
        await cargar(consulta.protocoloId, c);
        return;
      }
      const r = (
        modo === 'informativo' ? InterpretarCatalogoRespuesta : InterpretarRespuesta
      ).parse(
        await solicitar('/api/interpretar', c, {
          texto: consulta.texto,
          ...(modo === 'informativo' ? { modo: 'catalogo' } : {}),
        }),
      );
      if (c.signal.aborted) return;
      if (r.tipo === 'derivacion') {
        setEstado({ tipo: 'derivacion', resultado: r });
        return;
      }
      if (r.tipo === 'aclaracion') {
        setEstado({ tipo: 'aclaracion', alternativas: [...new Set(r.alternativas)] });
        return;
      }
      if (r.tipo === 'catalogo') {
        if (![...r.pasillo.baldas, ...r.pasillo.vitrina].some((g) => g.productos.length))
          setEstado({ tipo: 'vacio', catalogo: r.pasillo.catalogo });
        else onPasillo(r.pasillo);
        return;
      }
      // Los datos extraídos por la IA no se convierten en respuestas confirmadas.
      await cargar(r.protocoloId, c);
    });
  };
  const responder = (valor: string | number | boolean) => {
    if (estado.tipo !== 'preguntas' || pendiente.current) return;
    const { protocolo, pendientes } = estado;
    const respuestas = { ...estado.respuestas, [pendientes[0]!]: valor };
    setEstado({ ...estado, ocupada: true });
    void ejecutar(async (c) => {
      const r = TriajeRespuesta.parse(
        await solicitar('/api/triaje', c, {
          protocoloId: protocolo.id,
          version: protocolo.version,
          respuestas,
        }),
      );
      if (c.signal.aborted) return;
      if (r.tipo === 'derivar') {
        setEstado({ tipo: 'derivacion', resultado: r });
        return;
      }
      if (r.tipo === 'preguntas') {
        if (
          r.pendientes.some(
            (id) => !protocolo.preguntas.some((q) => q.id === id) || Object.hasOwn(respuestas, id),
          )
        )
          throw new Error('contrato');
        setEstado({
          tipo: 'preguntas',
          protocolo,
          respuestas,
          pendientes: r.pendientes,
          ocupada: false,
        });
        return;
      }
      if (
        r.pasilloId !== protocolo.id ||
        r.version !== protocolo.version ||
        r.pasillo.id !== protocolo.id ||
        r.pasillo.version !== protocolo.version ||
        r.pasillo.estado !== 'validado'
      )
        throw new Error('contrato');
      setEstado({ tipo: 'listo', pasillo: r.pasillo });
    });
  };

  if (estado.tipo === 'entrada')
    return (
      <Mostrador directo={modo === 'informativo'} onContinuar={continuar} onRevision={onActiva} />
    );
  const pregunta =
    estado.tipo === 'preguntas'
      ? estado.protocolo.preguntas.find((q) => q.id === estado.pendientes[0])
      : undefined;
  return (
    <div ref={cabecera} tabIndex={-1} className="space-y-5 outline-none">
      {estado.tipo === 'cargando' && (
        <p role="status" className="text-lg">
          Preparando tu consulta…
        </p>
      )}
      {estado.tipo === 'vacio' && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">
            {estado.catalogo?.estado === 'parcial'
              ? 'Aún no hay coincidencias en los datos cargados'
              : 'No se han encontrado coincidencias en esta copia'}
          </h2>
          <p>
            {estado.catalogo?.estado === 'parcial'
              ? 'La copia está pendiente de completar. Los resultados pueden aumentar cuando termine la carga.'
              : 'La búsqueda no ha encontrado coincidencias en las indicaciones disponibles de CIMA. Puedes elegir otra consulta.'}
          </p>
          <EstadoCatalogo datos={estado.catalogo} />
        </section>
      )}
      {estado.tipo === 'derivacion' && <Derivacion resultado={estado.resultado} />}
      {estado.tipo === 'aclaracion' && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">¿Te refieres a…?</h2>
          {estado.alternativas.length === 0 ? (
            <>
              <p>
                Necesitamos un poco más de detalle: indica dónde te molesta o qué dificultad notas.
              </p>
              <Mostrador directo={modo === 'informativo'} onContinuar={continuar} />
            </>
          ) : (
            estado.alternativas.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => elegirProtocolo(id)}
                className="min-h-12 w-full rounded-xl bg-white p-4 text-left font-semibold text-cruz ring-1 ring-cruz"
              >
                {CONSULTAS_FRECUENTES.find((q) => q.id === id)?.etiqueta}
              </button>
            ))
          )}
        </section>
      )}
      {estado.tipo === 'preguntas' && pregunta && (
        <>
          <p className="text-base text-tinta-suave">
            {estado.protocolo.titulo} · Pregunta{' '}
            {estado.protocolo.preguntas.length - estado.pendientes.length + 1} de{' '}
            {estado.protocolo.preguntas.length}
          </p>
          <Pregunta
            key={pregunta.id}
            pregunta={pregunta}
            ocupada={estado.ocupada}
            onResponder={responder}
          />
          <button
            type="button"
            disabled={estado.ocupada}
            onClick={() =>
              setEstado({
                tipo: 'derivacion',
                resultado: {
                  tipo: 'derivar',
                  urgencia: 'farmaceutico',
                  motivos: [
                    {
                      id: 'respuesta-desconocida',
                      descripcion:
                        'Falta una respuesta necesaria para completar la consulta con seguridad.',
                      urgencia: 'farmaceutico',
                    },
                  ],
                },
              })
            }
            className="min-h-12 w-full rounded-xl bg-white p-3 font-semibold text-cruz ring-1 ring-cruz disabled:opacity-50"
          >
            No lo sé
          </button>
          {estado.ocupada && <p role="status">Comprobando la respuesta…</p>}
        </>
      )}
      {estado.tipo === 'listo' && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Has completado las preguntas</h2>
          <p>
            El pasillo mostrará los productos del protocolo según tus respuestas. Ante cualquier
            duda, consulta con tu farmacéutico.
          </p>
          <button
            type="button"
            onClick={() => onPasillo(estado.pasillo)}
            className="min-h-12 w-full rounded-xl bg-cruz p-4 font-semibold text-white"
          >
            Ver el pasillo
          </button>
        </section>
      )}
      {estado.tipo === 'error' && (
        <section role="alert" className="space-y-3">
          <h2 className="text-2xl font-semibold">{MENSAJES_ERROR[estado.motivo].titulo}</h2>
          <p>{MENSAJES_ERROR[estado.motivo].texto}</p>
          {estado.motivo === 'indicaciones' && (
            <a
              href="/escena?vista=3d"
              className="inline-flex min-h-12 items-center rounded-xl bg-cruz px-4 font-semibold text-white"
            >
              Explorar medicamentos
            </a>
          )}
          {(estado.motivo === 'catalogo' || estado.motivo === 'protocolo') && (
            <a
              href="/escena?demo=1&vitrina=1&vista=3d"
              className="inline-flex min-h-12 items-center rounded-xl bg-cruz px-4 font-semibold text-white"
            >
              Ver demostración
            </a>
          )}
          <a
            href="tel:112"
            className="inline-flex min-h-12 items-center font-semibold text-cruz underline"
          >
            Ante una emergencia, llamar al 112
          </a>
        </section>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cruz/20 bg-papel p-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          type="button"
          onClick={nueva}
          className="mx-auto block min-h-12 w-full max-w-md rounded-xl bg-white p-3 font-semibold text-cruz ring-1 ring-cruz"
        >
          Nueva consulta
        </button>
      </div>
    </div>
  );
}
