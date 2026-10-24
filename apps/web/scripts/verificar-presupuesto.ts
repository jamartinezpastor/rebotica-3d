import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { medirJavaScript } from './presupuesto';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const informe = medirJavaScript(
  JSON.parse(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8')),
  await readFile(resolve(dist, 'index.html'), 'utf8'),
  (archivo) => {
    const ruta = resolve(dist, archivo);
    const relativa = relative(dist, ruta);
    if (relativa.startsWith('..') || isAbsolute(relativa)) throw new Error('Archivo fuera de dist');
    return readFileSync(ruta);
  },
);
await writeFile(resolve(dist, 'presupuesto-js.json'), JSON.stringify(informe, null, 2) + '\n');
console.log(`JavaScript inicial: ${(informe.gzipBytes / 1000).toFixed(2)} kB gzip (<250 kB).`);
