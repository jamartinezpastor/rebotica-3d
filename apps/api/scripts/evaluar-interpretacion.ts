import { clasificadorDesdeEntorno, MODELO_INTERPRETACION } from '../src/interpretacion/claude';
import { interpretar } from '../src/interpretacion/interpretar';
import { CASOS_CONSULTA } from '../test/fixtures/consultas';

// Opt-in: solo envía estas frases sintéticas, en serie; nunca datos de pacientes o .env.
const clasificar = clasificadorDesdeEntorno(process.env);
if (!clasificar) {
  console.error(
    'Evaluación no ejecutada: configura INTERPRETACION_IA_HABILITADA=true, ANTHROPIC_API_KEY y un modelo admitido.',
  );
  process.exitCode = 1;
} else {
  let fallos = 0;
  let fallosDerivacion = 0;
  let errores = 0;
  const modelo = process.env.ANTHROPIC_MODEL || MODELO_INTERPRETACION;
  console.log(`F4-02 · ${CASOS_CONSULTA.length} consultas sintéticas · modelo ${modelo}`);
  for (const caso of CASOS_CONSULTA) {
    try {
      const r = await interpretar(caso.texto, clasificar, AbortSignal.timeout(30000));
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
  }
  console.log(JSON.stringify({ casos: CASOS_CONSULTA.length, fallos, fallosDerivacion, errores }));
  if (fallos || errores) process.exitCode = 1;
}
