/** Comprobación explícita contra CIMA; no se ejecuta en CI ni modifica reglas o estados. */
import { fileURLToPath } from 'node:url';
import { leerReglasBorrador } from '../../../apps/api/src/reglas';
import { crearClienteCima } from '../src/cliente';
import { urlFichaTecnica } from '../src/cima';
import { SeccionesFT } from '../src/esquemas';
import { hashTexto, htmlATexto, reunirSecciones } from '../src/texto';

const directorio = fileURLToPath(new URL('../../../packages/dosis/data/reglas/', import.meta.url));
const reglas = await leerReglasBorrador(directorio, (m) => {
  console.error(m);
  process.exitCode = 1;
});
if (reglas.length !== 5) process.exitCode = 1;
const cliente = crearClienteCima();
for (const regla of reglas) {
  const secciones = await cliente.obtener(urlFichaTecnica(regla.fuente.nregistro), SeccionesFT);
  const s = reunirSecciones(secciones ?? []).find((s) => s.seccion === '4.2');
  const texto = htmlATexto(s?.contenido ?? '');
  const vigente =
    hashTexto(texto) === regla.fuente.hashSeccion &&
    !!regla.fuente.cita &&
    texto.includes(regla.fuente.cita);
  console.log(
    `${regla.id}: ${vigente ? 'fuente y cita coinciden' : 'requiere revisión de fuente'}`,
  );
  if (!vigente) process.exitCode = 1;
}
