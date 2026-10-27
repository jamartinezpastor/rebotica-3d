import {
  ClasificacionConsulta,
  ClasificacionCatalogo,
  InterpretarRespuesta,
  UMBRAL_CONFIANZA,
  type BusquedaIndicaciones,
} from '@rebotica/shared';
import { derivar, detectarAlarmas } from './alarmas';

export type Clasificador = (
  texto: string,
  signal: AbortSignal,
  modo?: 'catalogo',
) => Promise<unknown>;
type DecisionBusqueda = { tipo: 'busqueda'; busqueda: BusquedaIndicaciones };

export function interpretar(
  texto: string,
  clasificar: Clasificador | undefined,
  signal: AbortSignal,
): Promise<InterpretarRespuesta>;
export function interpretar(
  texto: string,
  clasificar: Clasificador | undefined,
  signal: AbortSignal,
  modo: 'catalogo',
): Promise<InterpretarRespuesta | DecisionBusqueda>;

export async function interpretar(
  texto: string,
  clasificar: Clasificador | undefined,
  signal: AbortSignal,
  modo?: 'catalogo',
): Promise<InterpretarRespuesta | DecisionBusqueda> {
  const local = derivar(detectarAlarmas(texto));
  if (local) return local;
  if (!clasificar) throw new Error('Interpretacion no disponible');

  // Mantiene el contrato anterior para triaje y para transportes de pruebas existentes.
  const bruto = modo ? await clasificar(texto, signal, modo) : await clasificar(texto, signal);
  const catalogo = modo
    ? ClasificacionCatalogo.parse({
        busqueda: null,
        ...(typeof bruto === 'object' && bruto ? bruto : {}),
      })
    : null;
  const resultado = catalogo ?? ClasificacionConsulta.parse(bruto);
  const busqueda = catalogo?.busqueda;
  // Contradicción detectada en datos estructurados: nunca ignorar fiebre en un lactante.
  if (resultado.protocoloId === 'fiebre' && resultado.datosExtraidos.grupo === 'bebe') {
    resultado.alarmasDetectadas.push('fiebre-bebe');
  }
  const alarmaModelo = derivar(resultado.alarmasDetectadas);
  if (alarmaModelo) return alarmaModelo;
  const { protocoloId, confianza, datosExtraidos } = resultado;
  if (
    modo &&
    !protocoloId &&
    busqueda &&
    !resultado.necesitaAclarar &&
    confianza >= UMBRAL_CONFIANZA &&
    !resultado.alternativas.length
  )
    return { tipo: 'busqueda', busqueda };
  if (
    resultado.necesitaAclarar ||
    (protocoloId && busqueda) ||
    confianza < UMBRAL_CONFIANZA ||
    !protocoloId ||
    resultado.alternativas.some((id) => id !== protocoloId)
  ) {
    const alternativas = [...new Set([protocoloId, ...resultado.alternativas])]
      .filter((id) => id !== null)
      .slice(0, 3);
    return InterpretarRespuesta.parse({
      tipo: 'aclaracion',
      confianza,
      datosExtraidos,
      alternativas,
    });
  }
  return InterpretarRespuesta.parse({
    tipo: 'clasificacion',
    protocoloId,
    confianza,
    datosExtraidos,
  });
}
