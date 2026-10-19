import { z } from 'zod';
import { CondicionPaciente, ReglaDosis } from './regla';
import { comprobarPeso, type ComprobacionPeso } from './peso';
import { Racional } from './racional';

export const EntradaDosis = z.strictObject({
  edadMeses: z.number().int().min(0).max(1200),
  pesoKg: z.number().positive(),
  condiciones: z.array(CondicionPaciente),
  motivo: z.string().trim().min(1),
  pesoConfirmado: z.boolean().default(false),
  /** La API propia sirve la sección actual: el motor no consulta CIMA ni guarda datos. */
  fuenteActual: z.strictObject({
    nregistro: z.string().min(1),
    hashSeccion: z.string().min(1),
    texto: z.string().min(1),
  }),
});
export type EntradaDosis = z.input<typeof EntradaDosis>;

type MotivoNoDisponible =
  | 'datosInvalidos'
  | 'reglaInvalida'
  | 'sinValidar'
  | 'fuenteDesactualizada'
  | 'sinCita'
  | 'sinDuracion'
  | 'cantidadNoDosificable'
  | 'limiteDiario'
  | 'precisionNoSoportada';

export type ResultadoDosis =
  | { tipo: 'noDisponible'; motivo: MotivoNoDisponible }
  | {
      tipo: 'derivar';
      motivo: 'fueraTramo' | 'bloqueo';
      condiciones: CondicionPaciente[];
      mensaje: string;
    }
  | { tipo: 'confirmarPeso'; comprobacion: ComprobacionPeso; mensaje: string }
  | {
      tipo: 'calculada';
      cantidadToma: number;
      unidadToma: ReglaDosis['presentacion']['unidadToma'];
      mgToma: number;
      intervaloHoras: number;
      maxTomasDia: number;
      maxMgDia: number;
      diasMaxSinConsultar: number;
      avisos: CondicionPaciente[];
      trazabilidad: { reglaId: string; version: number; fuente: ReglaDosis['fuente'] };
    };

/** F3-02: función pura. Sin regla, firma, vigencia, cita o cantidad medible, nunca devuelve pauta. */
export function calcularDosis(
  reglaSinValidar: unknown,
  entradaSinValidar: unknown,
): ResultadoDosis {
  const r = ReglaDosis.safeParse(reglaSinValidar);
  if (!r.success) return { tipo: 'noDisponible', motivo: 'reglaInvalida' };
  const regla = r.data;
  if (regla.estado !== 'validada') return { tipo: 'noDisponible', motivo: 'sinValidar' };
  const e = EntradaDosis.safeParse(entradaSinValidar);
  if (!e.success) return { tipo: 'noDisponible', motivo: 'datosInvalidos' };
  const entrada = e.data;
  const { fuente } = regla;
  if (
    fuente.nregistro !== entrada.fuenteActual.nregistro ||
    fuente.hashSeccion !== entrada.fuenteActual.hashSeccion
  ) {
    return { tipo: 'noDisponible', motivo: 'fuenteDesactualizada' };
  }
  if (!fuente.cita || !entrada.fuenteActual.texto.includes(fuente.cita))
    return { tipo: 'noDisponible', motivo: 'sinCita' };
  const diasMaxSinConsultar = Object.hasOwn(regla.diasMaxSinConsultar, entrada.motivo)
    ? regla.diasMaxSinConsultar[entrada.motivo]
    : undefined;
  if (diasMaxSinConsultar === undefined) return { tipo: 'noDisponible', motivo: 'sinDuracion' };

  // 1. Límites inclusivos por abajo y exclusivos por arriba, por edad Y por peso.
  const tramo = regla.tramos.find(
    (t) =>
      entrada.edadMeses >= t.edadMinMeses &&
      (t.edadMaxMeses === undefined || entrada.edadMeses < t.edadMaxMeses) &&
      (t.pesoMinKg === undefined || entrada.pesoKg >= t.pesoMinKg) &&
      (t.pesoMaxKg === undefined || entrada.pesoKg < t.pesoMaxKg),
  );
  if (!tramo)
    return {
      tipo: 'derivar',
      motivo: 'fueraTramo',
      condiciones: [],
      mensaje: 'No indicado para esta edad o peso, consulta con un profesional.',
    };

  // 2. Un bloqueo tiene prioridad sobre la confirmación del peso y sobre cualquier resultado.
  const condiciones = regla.bloqueos.filter((c) => entrada.condiciones.includes(c));
  if (condiciones.length > 0)
    return {
      tipo: 'derivar',
      motivo: 'bloqueo',
      condiciones,
      mensaje: 'Esta situación requiere valoración profesional antes de calcular una pauta.',
    };

  // 3–4. Cálculo y redondeo exactos al paso transcrito; nunca se redondea hacia arriba.
  const peso = Racional.de(entrada.pesoKg);
  const concentracion = Racional.de(regla.presentacion.concentracion);
  const paso = Racional.de(regla.presentacion.pasoDosificable);
  const teorica =
    tramo.modo === 'porPeso'
      ? Racional.de(tramo.mgKgToma).multiplicar(peso)
      : Racional.de(tramo.mgToma);
  const limitada =
    tramo.maxMgToma === undefined ? teorica : teorica.minimo(Racional.de(tramo.maxMgToma));
  const pasos = limitada.dividir(concentracion).dividir(paso).suelo();
  if (pasos === 0n) return { tipo: 'noDisponible', motivo: 'cantidadNoDosificable' };
  const cantidad = paso.multiplicar(new Racional(pasos));
  const mg = cantidad.multiplicar(concentracion);

  // 5. El tope diario limita las tomas; no inventamos una dosis menor para encajar una pauta.
  let maximo =
    tramo.modo === 'porPeso'
      ? Racional.de(tramo.maxMgKgDia).multiplicar(peso)
      : Racional.de(tramo.maxMgDia);
  if (tramo.maxMgDia !== undefined) maximo = maximo.minimo(Racional.de(tramo.maxMgDia));
  if (tramo.maxMgKgDia !== undefined)
    maximo = maximo.minimo(Racional.de(tramo.maxMgKgDia).multiplicar(peso));
  const porIntervalo = Racional.de(24).dividir(Racional.de(tramo.intervaloHoras)).techo();
  const porMaximo = maximo.dividir(mg).suelo();
  const tomas = porIntervalo < porMaximo ? porIntervalo : porMaximo;
  if (tomas === 0n) return { tipo: 'noDisponible', motivo: 'limiteDiario' };
  const cantidadToma = cantidad.numeroExacto();
  const mgToma = mg.numeroExacto();
  const maxMgDia = maximo.numeroExacto();
  if (
    cantidadToma === null ||
    mgToma === null ||
    maxMgDia === null ||
    tomas > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return { tipo: 'noDisponible', motivo: 'precisionNoSoportada' };
  }

  // 7. No se entrega una pauta hasta confirmar el dato inusual o sin referencia disponible.
  const comprobacion = comprobarPeso(entrada.edadMeses, entrada.pesoKg);
  if (comprobacion.requiereConfirmacion && !entrada.pesoConfirmado) {
    return {
      tipo: 'confirmarPeso',
      comprobacion,
      mensaje: 'Revisa la edad y el peso en kg y confirma que son correctos antes de continuar.',
    };
  }

  // 6. Resultado y trazabilidad literal de la ficha, sin texto clínico generado.
  return {
    tipo: 'calculada',
    cantidadToma,
    unidadToma: regla.presentacion.unidadToma,
    mgToma,
    intervaloHoras: tramo.intervaloHoras,
    maxTomasDia: Number(tomas),
    maxMgDia,
    diasMaxSinConsultar,
    avisos: regla.avisos.filter((c) => entrada.condiciones.includes(c)),
    trazabilidad: { reglaId: regla.id, version: regla.version, fuente: { ...fuente } },
  };
}
