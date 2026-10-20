import { setTimeout as esperar } from 'node:timers/promises';
import { clasificadorDesdeEntorno, MODELO_INTERPRETACION } from '../src/interpretacion/gemini';
import { interpretar } from '../src/interpretacion/interpretar';
import { CASOS_CONSULTA } from '../test/fixtures/consultas';

// Opt-in: solo envía estas frases sintéticas, en serie; nunca datos de pacientes o .env.
const clasificar = clasificadorDesdeEntorno(process.env);
if (!clasificar) {
  console.error(
    'Evaluación no ejecutada: configura INTERPRETACION_IA_HABILITADA=true, GEMINI_API_KEY y un modelo admitido.',
  );
  process.exitCode = 1;
} else {
  const clasificadorBase = clasificar;
  const intervaloMs = Number(process.env.EVALUACION_INTERVALO_MS ?? 4000);
  if (!Number.isFinite(intervaloMs) || intervaloMs < 0 || intervaloMs > 60000) {
    console.error('EVALUACION_INTERVALO_MS debe estar entre 0 y 60000.');
    process.exit(1);
  }
  let siguientePeticion = 0;
  const clasificarPausado: typeof clasificadorBase = async (texto, signal) => {
    await esperar(Math.max(0, siguientePeticion - Date.now()), undefined, { signal });
    siguientePeticion = Date.now() + intervaloMs;
    return clasificadorBase(texto, signal);
  };
  let fallos = 0;
  let fallosDerivacion = 0;
  let errores = 0;
  let procesadas = 0;
  const modelo = process.env.GEMINI_MODEL || MODELO_INTERPRETACION;
  console.log(`F4-02 · ${CASOS_CONSULTA.length} consultas sintéticas · modelo ${modelo}`);
  for (const caso of CASOS_CONSULTA) {
    try {
      const r = await interpretar(
        caso.texto,
        clasificarPausado,
        AbortSignal.timeout(30000 + intervaloMs),
      );
      const derivacionCorrecta =
        !caso.destino || (r.tipo === 'derivacion' && r.destino === caso.destino);
      const clasificacionCorrecta = caso.destino
        ? derivacionCorrecta
        : caso.protocoloId
          ? r.tipo === 'clasificacion' && r.protocoloId === caso.protocoloId
          : r.tipo === 'aclaracion';
      if (!derivacionCorrecta) fallosDerivacion++;
      if (!clasificacionCorrecta) {
        fallos++;
        console.log(`${caso.id}: expectativa no cumplida (${r.tipo})`);
      }
    } catch {
      errores++;
      if (caso.destino) fallosDerivacion++;
      // No imprimir la excepción, entrada, salida o clave, ni guardarlas en disco.
      console.log(`${caso.id}: no disponible`);
    }
    procesadas++;
    if (!caso.destino && procesadas % 10 === 0)
      console.log(`Procesadas ${procesadas}/${CASOS_CONSULTA.length}`);
  }
  console.log(JSON.stringify({ casos: CASOS_CONSULTA.length, fallos, fallosDerivacion, errores }));
  if (fallos || errores) process.exitCode = 1;
}
