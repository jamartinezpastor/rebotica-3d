import { conectar } from '@rebotica/db';
import { construirAssets } from './assets/construir';
import { crearClienteCima } from './cliente';
import { sincronizacionDiaria } from './cambios';
import { sincronizar } from './sync';

// Uso: node index.js [--completo] [--limite N]
//   sin opciones: pasada nocturna (completa la primera vez; después, solo los cambios de CIMA)
//   --completo:   fuerza la sincronización completa
//   --limite N:   ensayo con N medicamentos; no avanza la marca de la última pasada
//   --solo-assets: no sincroniza; solo regenera fotos y atlas (necesita ASSETS_DIR)
//   --forzar-assets: regenera los atlas aunque nada haya cambiado
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
  const soloAssets = argumentos.includes('--solo-assets');
  if (soloAssets && !process.env.ASSETS_DIR) {
    console.error('sync-cima: --solo-assets necesita ASSETS_DIR');
    process.exit(2);
  }
  if (soloAssets) {
    // Nada que sincronizar: se pasa directamente a los assets.
  } else if (limite !== undefined) {
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

  // Un fallo de assets no invalida la sincronización de datos, pero sí el código de salida.
  if (limite === undefined && process.env.ASSETS_DIR) {
    try {
      const assets = await construirAssets(db, {
        directorio: process.env.ASSETS_DIR,
        cliente,
        urlBase: process.env.ASSETS_URL_BASE,
        forzar: argumentos.includes('--forzar-assets'),
        log,
      });
      console.log(JSON.stringify({ assets }, null, 2));
    } catch (err) {
      console.error('sync-cima: fallo en assets', err);
      codigo = 1;
    }
  } else if (limite === undefined) {
    log('ASSETS_DIR sin definir: se omiten fotos y atlas');
  }
} catch (err) {
  console.error('sync-cima: fallo', err);
  codigo = 1;
} finally {
  await pool.end();
}
process.exit(codigo);
