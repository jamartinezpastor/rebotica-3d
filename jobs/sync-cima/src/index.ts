import { conectar } from '@rebotica/db';
import { crearClienteCima } from './cliente';
import { sincronizacionDiaria } from './cambios';
import { sincronizar } from './sync';

// Uso: node index.js [--completo] [--limite N]
//   sin opciones: pasada nocturna (completa la primera vez; después, solo los cambios de CIMA)
//   --completo:   fuerza la sincronización completa
//   --limite N:   ensayo con N medicamentos; no avanza la marca de la última pasada
const argumentos = process.argv.slice(2);
const posicion = argumentos.indexOf('--limite');
const limite = posicion >= 0 ? Number(argumentos[posicion + 1]) : undefined;
if (limite !== undefined && (!Number.isInteger(limite) || limite <= 0)) {
  console.error('sync-cima: --limite necesita un entero positivo');
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('sync-cima: falta DATABASE_URL');
  process.exit(2);
}

const { db, pool } = conectar(databaseUrl);
const cliente = crearClienteCima({
  intervaloMs: process.env.CIMA_INTERVALO_MS ? Number(process.env.CIMA_INTERVALO_MS) : undefined,
});

let codigo = 0;
try {
  const log = (mensaje: string) => console.log(`sync-cima: ${mensaje}`);
  if (limite !== undefined) {
    const informe = await sincronizar(db, cliente, { limite, log });
    console.log(JSON.stringify({ modo: 'ensayo', informe }, null, 2));
    if (informe.errores.length > 0) codigo = 1;
  } else {
    const resultado = await sincronizacionDiaria(db, cliente, {
      forzarCompleto: argumentos.includes('--completo'),
      log,
    });
    console.log(JSON.stringify(resultado, null, 2));
    if (resultado.informe.errores.length > 0) codigo = 1;
  }
} catch (err) {
  console.error('sync-cima: fallo', err);
  codigo = 1;
} finally {
  await pool.end();
}
process.exit(codigo);
