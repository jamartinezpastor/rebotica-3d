import {
  GrupoPaciente,
  RespuestasTriaje,
  respuestaValida,
  type DerivacionTriaje,
  type CuandoTriaje,
  type Urgencia,
} from '@rebotica/shared';
import { Protocolo } from './index';

const PRIORIDAD: Record<Urgencia, number> = { '112': 0, urgencias: 1, medico: 2, farmaceutico: 3 };
export function protocoloEvaluable(p: Protocolo): boolean {
  const preguntaDe = (tipo: string) => p.preguntasTriaje.some((q) => q.tipo === tipo);
  const restriccionesCubiertas = p.baldas.every(
    (b) =>
      (!b.gruposExcluidos.length || preguntaDe('grupo')) &&
      (b.edadMinMeses === undefined || preguntaDe('edad')) &&
      b.condicionesExcluidas.every((id) =>
        p.preguntasTriaje.some((q) => q.id === id && q.tipo === 'siNo'),
      ),
  );
  return (
    p.estado === 'validado' &&
    !!p.validadoPor &&
    !!p.validadoEn &&
    p.validadoEn <= new Date().toISOString().slice(0, 10) &&
    restriccionesCubiertas &&
    p.preguntasTriaje.length > 0 &&
    p.criteriosDerivacion.every((c) => !!c.cuando)
  );
}

/** Lógica de tres valores: una respuesta ausente nunca equivale a «no». */
function cumple(cuando: CuandoTriaje, respuestas: RespuestasTriaje): boolean | undefined {
  const condiciones = 'todas' in cuando ? cuando.todas : cuando.alguna;
  const valores = condiciones.map((c) => {
    const valor = Object.hasOwn(respuestas, c.preguntaId) ? respuestas[c.preguntaId] : undefined;
    if (valor === undefined) return undefined;
    if (c.operador === 'igual') return valor === c.valor;
    if (typeof valor !== 'number') return undefined;
    switch (c.operador) {
      case 'menor':
        return valor < c.valor;
      case 'menorIgual':
        return valor <= c.valor;
      case 'mayor':
        return valor > c.valor;
      case 'mayorIgual':
        return valor >= c.valor;
    }
  });
  if ('todas' in cuando)
    return valores.includes(false) ? false : valores.includes(undefined) ? undefined : true;
  return valores.includes(true) ? true : valores.includes(undefined) ? undefined : false;
}

export type ResultadoTriaje =
  | DerivacionTriaje
  | { tipo: 'preguntas'; pendientes: string[] }
  | { tipo: 'no-disponible'; motivo: 'protocolo' | 'respuestas' }
  | { tipo: 'apto'; perfil: { grupo?: GrupoPaciente; edadMeses?: number; condiciones: string[] } };

/** No contiene umbrales clínicos: todos proceden del protocolo firmado que recibe. */
export function evaluarTriaje(datos: unknown, entrada: unknown): ResultadoTriaje {
  const validado = Protocolo.safeParse(datos);
  if (!validado.success || !protocoloEvaluable(validado.data))
    return { tipo: 'no-disponible', motivo: 'protocolo' };
  const p = validado.data;
  const analizadas = RespuestasTriaje.safeParse(entrada);
  if (!analizadas.success) return { tipo: 'no-disponible', motivo: 'respuestas' };
  const respuestas = analizadas.data;
  if (
    Object.entries(respuestas).some(([id, valor]) => {
      const pregunta = p.preguntasTriaje.find((q) => q.id === id);
      return !pregunta || !respuestaValida(pregunta, valor);
    })
  )
    return { tipo: 'no-disponible', motivo: 'respuestas' };

  const motivos = p.criteriosDerivacion
    .filter((c) => cumple(c.cuando!, respuestas) === true)
    .map(({ id, descripcion, urgencia }) => ({ id, descripcion, urgencia }))
    .sort((a, b) => PRIORIDAD[a.urgencia] - PRIORIDAD[b.urgencia]);
  if (motivos.length > 0) return { tipo: 'derivar', urgencia: motivos[0]!.urgencia, motivos };
  const pendientes = p.preguntasTriaje
    .filter((q) => !Object.hasOwn(respuestas, q.id))
    .map((q) => q.id);
  if (pendientes.length) return { tipo: 'preguntas', pendientes };
  const grupo = p.preguntasTriaje.find((q) => q.tipo === 'grupo');
  const edad = p.preguntasTriaje.find((q) => q.tipo === 'edad');
  // Las condiciones se confirman explícitamente con preguntas si/no cuyo id es el de la
  // restricción curada de la balda; ninguna condición se infiere de texto o del modelo.
  const condiciones = p.preguntasTriaje
    .filter((q) => q.tipo === 'siNo' && respuestas[q.id] === true)
    .map((q) => q.id);
  return {
    tipo: 'apto',
    perfil: {
      ...(grupo ? { grupo: GrupoPaciente.parse(respuestas[grupo.id]) } : {}),
      ...(edad ? { edadMeses: respuestas[edad.id] as number } : {}),
      condiciones,
    },
  };
}
