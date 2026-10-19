import referencia from '../data/peso-oms.json';

export interface ComprobacionPeso {
  requiereConfirmacion: boolean;
  motivo: 'fueraReferencia' | 'sinReferencia' | null;
  rango: { minKg: number; maxKg: number } | null;
}

/**
 * Unión de los intervalos -3/+3 DE de niñas y niños, al no recoger sexo en el triaje.
 * Solo confirma la entrada: no diagnostica ni modifica la dosis o los límites de la regla.
 * No extrapola a edades sin tabla OMS de peso por edad.
 */
export function comprobarPeso(edadMeses: number, pesoKg: number): ComprobacionPeso {
  if (!Number.isInteger(edadMeses) || edadMeses < 0 || !Number.isFinite(pesoKg) || pesoKg <= 0) {
    return { requiereConfirmacion: true, motivo: 'sinReferencia', rango: null };
  }
  const fila = referencia.rangos.find(([mes]) => mes === edadMeses);
  if (!fila || fila[1] === undefined || fila[2] === undefined) {
    return { requiereConfirmacion: true, motivo: 'sinReferencia', rango: null };
  }
  const rango = { minKg: fila[1], maxKg: fila[2] };
  const fuera = pesoKg < rango.minKg || pesoKg > rango.maxKg;
  return { requiereConfirmacion: fuera, motivo: fuera ? 'fueraReferencia' : null, rango };
}
