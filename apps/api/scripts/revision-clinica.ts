import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepararRevisionClinica, revisionClinicaMarkdown } from '../src/revision-clinica';

// Sin carga de .env, red, BD ni modificación de fuentes clínicas.
if (process.argv.length > 2) {
  console.error('Uso: pnpm revision:clinica (sin argumentos).');
  process.exitCode = 1;
} else {
  try {
    const informe = await prepararRevisionClinica({
      reglasDir: fileURLToPath(new URL('../../../packages/dosis/data/reglas/', import.meta.url)),
      protocolosDir: fileURLToPath(new URL('../../../packages/protocolos/data/', import.meta.url)),
    });
    const salida = new URL('../../../.local/revision-clinica/', import.meta.url);
    await mkdir(salida, { recursive: true });
    await writeFile(new URL('informe.json', salida), JSON.stringify(informe, null, 2) + '\n');
    await writeFile(new URL('informe.md', salida), revisionClinicaMarkdown(informe));
    console.log(JSON.stringify(informe.resumen, null, 2));
    console.log('Informe: .local/revision-clinica/informe.md e informe.json.');
    console.log('Preparación técnica; revisión farmacéutica pendiente. No publica contenido.');
    if (informe.resumen.erroresTecnicos) process.exitCode = 1;
  } catch {
    console.error('No se pudo generar el informe de revisión clínica.');
    process.exitCode = 1;
  }
}
