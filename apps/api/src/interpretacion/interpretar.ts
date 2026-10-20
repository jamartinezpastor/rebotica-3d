import { ClasificacionConsulta, InterpretarRespuesta, UMBRAL_CONFIANZA } from '@rebotica/shared';
import { derivar, detectarAlarmas } from './alarmas';

export type Clasificador = (texto: string, signal: AbortSignal) => Promise<unknown>;

export async function interpretar(
  texto: string,
  clasificar: Clasificador | undefined,
  signal: AbortSignal,
): Promise<InterpretarRespuesta> {
  const local = derivar(detectarAlarmas(texto));
  if (local) return local;
  if (!clasificar) throw new Error('Interpretacion no disponible');

  const resultado = ClasificacionConsulta.parse(await clasificar(texto, signal));
  // Contradicción detectada en datos estructurados: nunca ignorar fiebre en un lactante.
  if (resultado.protocoloId === 'fiebre' && resultado.datosExtraidos.grupo === 'bebe') {
    resultado.alarmasDetectadas.push('fiebre-bebe');
  }
  const alarmaModelo = derivar(resultado.alarmasDetectadas);
  if (alarmaModelo) return alarmaModelo;
  const { protocoloId, confianza, datosExtraidos } = resultado;
  if (
    resultado.necesitaAclarar ||
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
